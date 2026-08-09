# Setup Instructions

## Prerequisites
- A Jenkins server, with `gcloud`, `docker`, and `kubectl` installed on the Jenkins agent
- A GCP project with:
  - **Artifact Registry** enabled (container registry)
  - **GKE** cluster (or any Kubernetes cluster you have `kubectl` access to)
- A GCP **service account** with permissions to push to Artifact Registry and
  deploy to GKE (`roles/artifactregistry.writer`, `roles/container.developer`)
- Jenkins plugins: **GitHub Plugin** (for the push trigger), **Docker Pipeline**

## 1. Repository layout

The Jenkinsfile lives **inside the application repository**, not in a
separate "CI config repo." Jenkins is configured with "Pipeline script from
SCM," so it always builds whichever repo/branch triggered it — there's no
separate repo URL to keep in sync with the actual code.

```
your-app-repo/
├── Jenkinsfile
├── app/
├── k8s/
└── docs/
```

## 2. Configure Jenkins credentials

In Jenkins: **Manage Jenkins → Credentials → Add Credentials**

| Credential ID              | Type            | What it holds                              |
|------------------------------|------------------|-----------------------------------------------|
| `gcp-service-account-key`    | Secret file      | JSON key file for the GCP service account   |
| `kubeconfig-credentials`     | Secret file      | kubeconfig for the target GKE cluster       |

These IDs are referenced by name in the `Jenkinsfile` — they must match exactly.

## 3. Create the Jenkins pipeline job

1. New Item → Pipeline
2. Under **Pipeline**, choose "Pipeline script from SCM"
3. SCM: Git → point it at your application repository, branch `main`
4. Script path: `Jenkinsfile`

## 4. Set up the webhook (so commits auto-trigger builds)

This is what satisfies "Jenkins should automatically trigger a build on
commit" — the `triggers { githubPush() }` block in the Jenkinsfile only
works once the webhook side is wired up:

1. In your GitHub repo: Settings → Webhooks → Add webhook
2. Payload URL: `http://<your-jenkins-url>/github-webhook/`
3. Content type: `application/json`
4. Trigger on: **push events**
5. In the Jenkins job config, confirm "GitHub hook trigger for GITScm
   polling" is checked (this is enabled automatically once `githubPush()`
   is present in the Jenkinsfile and the job has run once)

## 5. Adjust parameters for your environment

The Jenkinsfile exposes these build parameters:
- `K8S_NAMESPACE` — target namespace on the cluster
- `IMAGE_NAME` — image name
- `GCP_PROJECT_ID` — GCP project hosting Artifact Registry / GKE
- `REGISTRY_HOST` — Artifact Registry host, e.g. `asia-south1-docker.pkg.dev`

Change the **defaults** in the `parameters` block to match your project, or
override them per-build via "Build with Parameters" in Jenkins. This is what
makes the pipeline reusable across different clusters/projects without
touching the pipeline code.

## 6. Run it

- Push a commit — the webhook triggers the build automatically.
- Or click "Build with Parameters" in Jenkins to trigger manually.
- Watch the stage view in Jenkins for progress.
- Verify the deployment:
  ```
  kubectl get pods -n <namespace>
  kubectl get deployment cicd-demo-app -n <namespace>
  ```

## 7. Local test before wiring up Jenkins (optional)

Sanity-check the app and image locally, without touching GCP:
```
cd app
npm ci
npm test
docker build -t cicd-demo-app:local .
docker run -p 3000:3000 cicd-demo-app:local
curl http://localhost:3000/health
```

## Notes on registry choice

This pipeline targets **Google Artifact Registry** to match the GCP stack
used by the target role/client. If you want to demo the pipeline without a
GCP account, the only stage that needs changing is **"Push Docker Image"** —
swap the `gcloud auth` + push commands for a `docker login` +
`docker push` against Docker Hub, and swap `REGISTRY_HOST`/`GCP_PROJECT_ID`
for your Docker Hub username. Everything else (checkout, test, build,
deploy) stays identical.
