# CI/CD Pipeline: Git → Jenkins → Kubernetes

A CI/CD pipeline that automatically builds and deploys an application whenever
code is pushed to a Git repository. Built for the SRE/DevOps Intern case study.

## Architecture

```
Developer push
     │
     ▼
  Git Repo (contains Jenkinsfile) ──(webhook, auto-trigger)──▶  Jenkins
                                                                    │
                                                          Checkout (checkout scm)
                                                                    │
                                                              Install & Test
                                                                    │
                                                            Build Docker Image
                                                                    │
                                                    Push to Google Artifact Registry
                                                                    │
                                                            Deploy to Kubernetes
                                                                    │
                                                    Rolling update, health checks
```

The Jenkinsfile lives inside the application repo itself (Jenkins job is
configured as "Pipeline script from SCM"), so there's only one repo to
think about — Jenkins always builds whatever repo/branch triggered it.

## Repository Structure

```
.
├── Jenkinsfile              # Groovy pipeline definition (the automation logic)
├── app/                     # Sample application being built & deployed
│   ├── index.js
│   ├── package.json
│   ├── test.js
│   └── Dockerfile
├── k8s/
│   ├── deployment.yaml      # K8s Deployment (rolling updates, resource limits, probes)
│   └── service.yaml         # K8s Service (exposes the app inside the cluster)
├── docs/
│   └── SETUP.md             # Step-by-step setup instructions
└── README.md
```

## How it works, stage by stage

0. **Trigger** — a GitHub webhook fires on every push; `triggers { githubPush() }`
   in the Jenkinsfile makes this automatic, no manual "build now" click needed.
1. **Checkout** — `checkout scm` pulls whatever repo/branch triggered the build.
2. **Install & Test** — installs dependencies and runs a smoke test. If tests
   fail, the pipeline stops here; nothing broken gets built into an image.
3. **Build Docker Image** — packages the app into a container image, tagged
   with the Jenkins build number so every deploy is traceable back to a
   specific build.
4. **Push Docker Image** — authenticates with a GCP service account and pushes
   the image to **Google Artifact Registry**, matching the GCP stack used by
   the target role.
5. **Deploy to Kubernetes** — applies the Deployment and Service manifests to
   the target cluster and waits for the rollout to finish successfully before
   marking the pipeline green.

## Why it's scalable / reusable across repos & clusters

- The repo URL, branch, namespace, and image name are all **parameters**, not
  hardcoded values — the same Jenkinsfile can build a different repo or
  deploy to a different cluster just by changing parameters when triggering
  the job.
- Credentials (registry login, kubeconfig) are pulled from Jenkins'
  credential store by ID, never written into the pipeline file. This means
  the same pipeline works in any environment as long as the credential IDs
  exist.

## Security practices applied

- No secrets committed to the repo — all credentials live in Jenkins.
- The app's Docker container runs as a **non-root user**.
- Docker registry session is explicitly logged out at the end of every run
  (`post { always { docker logout } }`).
- Resource limits are set in the K8s Deployment to prevent a runaway
  container from starving other workloads on the cluster.

## Error handling

- `timeout(20 minutes)` prevents a stuck stage from blocking the Jenkins
  queue indefinitely.
- `kubectl rollout status ... --timeout=120s` makes sure the pipeline only
  reports success once pods are actually healthy — a bad image that crash-
  loops will fail the build instead of silently "succeeding."
- `post { failure { ... } }` is the hook point for alerting (Slack/email) —
  noted in the docs as a next step.

## Design decisions worth being able to explain

- **Jenkinsfile lives in the app repo, not a separate config repo.** Using
  "Pipeline script from SCM" plus `checkout scm` means one Jenkins job
  definition always builds whatever triggered it — no risk of the pipeline
  config drifting out of sync with a separately-versioned repo URL.
- **Artifact Registry over Docker Hub.** The target role's stack is GCP, so
  the pipeline pushes to Google Artifact Registry rather than a third-party
  registry — one less external dependency, and IAM-based auth instead of a
  separate registry login. Docker Hub is still a valid choice for
  registry-agnostic projects; swapping it back in is a one-stage change (see
  `docs/SETUP.md`, "Notes on registry choice").
- **The scope stops at Git → Jenkins → Kubernetes on purpose.** The case
  study explicitly asks for Git, Jenkins, Kubernetes, and Groovy — it doesn't
  ask for GCP infrastructure itself (that's separately listed in the JD as
  a general skill, not a case-study requirement). Rather than bolt on
  Terraform/GKE cluster provisioning just to name-drop GCP, the registry and
  cluster target are the GCP touchpoints, and Terraform/GKE setup is called
  out as the natural "production extension" below.
- **Tests exercise the real running app**, not an unrelated arithmetic
  check — `npm test` starts the actual Express server and asserts on the
  `/health` and `/` responses, the same endpoint Kubernetes uses for its
  liveness/readiness probes. That connects testing → app → container →
  cluster health checks into one coherent chain instead of three unrelated
  pieces.
- **`npm ci` instead of `npm install` in CI.** `npm ci` installs strictly
  from `package-lock.json` and fails if the lockfile and `package.json` are
  out of sync, instead of silently rewriting the lockfile. That's what you
  want in a build pipeline — reproducible installs, not surprises.

## How I'd harden this further for production

Two deliberate simplifications were made for this case study, and it's worth
being upfront about them and how they'd change in a real deployment:

- **Service account keys → Workload Identity.** The pipeline currently
  authenticates to GCP using a long-lived service account JSON key stored in
  Jenkins credentials. That's a reasonable way to demonstrate credential
  management for a case study, but in production I'd move to Workload
  Identity Federation (or short-lived, auto-rotated credentials) so there's
  no long-lived key sitting in a secrets store at all.
- **Cluster-wide kubeconfig → scoped RBAC.** The deploy stage currently uses
  a kubeconfig that can reach the whole cluster. In production, Jenkins
  should instead use a dedicated Kubernetes service account whose RBAC role
  is limited to exactly the namespace and resource types (Deployments,
  Services) this pipeline needs — least privilege, so a compromised Jenkins
  credential can't touch the rest of the cluster.

## Monitoring & logging recommendations (optional deliverable)

- **Prometheus** + the `kube-state-metrics` exporter to track pod
  restarts, deployment rollout status, and resource usage.
- **Grafana** dashboard on top of Prometheus to visualize build frequency,
  deployment frequency, and failure rate — these map to standard DORA
  metrics, which is a good thing to mention in an SRE interview.
- Ship Jenkins build logs and pod logs to a central place (e.g., GCP
  Cloud Logging, or an ELK/EFK stack) so failures can be debugged without
  SSH-ing into individual nodes.

See `docs/SETUP.md` for exact setup steps.
