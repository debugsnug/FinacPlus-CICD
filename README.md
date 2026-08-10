# FinacPlus CI/CD Pipeline

A CI/CD pipeline for automatically testing, containerizing, and deploying a Node.js application using Jenkins, Docker, Docker Hub, and Kubernetes.

## Overview

The pipeline automates the application delivery process:

```
GitHub
  ↓
Jenkins
  ↓
Install & Test
  ↓
Docker Build
  ↓
Docker Hub
  ↓
Kubernetes
  ↓
Rolling Deployment
```

## Technology Stack

- GitHub
- Jenkins
- Groovy
- Node.js / npm
- Docker
- Docker Hub
- Kubernetes / kubectl
- Docker Desktop Kubernetes

## Repository Structure

```
.
├── Jenkinsfile
├── README.md
├── .gitignore
├── app/
│   ├── Dockerfile
│   ├── index.js
│   ├── package.json
│   ├── package-lock.json
│   └── test.js
├── k8s/
│   ├── deployment.yaml
│   └── service.yaml
└── docs/
    └── SETUP.md
```

## Application

The application is a Node.js service running on port 3000.

Endpoints:
- `/` — application response
- `/health` — health-check endpoint

## CI/CD Pipeline

### 1. Checkout

Jenkins checks out the source code from the configured Git repository.

### 2. Install & Test

Dependencies are installed using `npm ci`, and automated tests are run with `npm test`. The pipeline stops if the tests fail.

### 3. Build Docker Image

The application is packaged into a Docker image, tagged with the Jenkins build number:
```
debugsnug/cicd-demo-app:<BUILD_NUMBER>
```

### 4. Push to Docker Hub

The image is pushed to `debugsnug/cicd-demo-app`. Docker Hub credentials are stored securely in Jenkins Credentials.

### 5. Deploy to Kubernetes

Jenkins applies the Kubernetes Deployment and Service manifests and deploys the newly built image.

### 6. Verify Deployment

Jenkins waits for the Kubernetes rollout to complete and verifies the Deployment, Pods, and Service.

## Kubernetes

The application runs with two replicas using a `RollingUpdate` strategy. The Deployment includes:
- Readiness probe
- Liveness probe
- CPU and memory requests
- CPU and memory limits

The application is exposed through a Kubernetes `ClusterIP` Service.

## Security

- Docker Hub credentials are stored in Jenkins Credentials.
- Kubernetes credentials are stored in Jenkins Credentials.
- Local kubeconfig and environment files are excluded via `.gitignore`.
- The Docker container runs as a non-root user.
- Docker registry sessions are logged out after pipeline execution.
- Kubernetes resource limits are configured.

## Testing

The application was tested using:
```
cd app
npm ci
npm test
```

The Docker image was successfully built and pushed to Docker Hub, and the Kubernetes deployment was successfully rolled out with two running replicas.

A subsequent application change from `version: dev` to `version: v2` was deployed through the CI/CD pipeline and verified through the running Kubernetes application.

## Local Testing

Install dependencies and run tests:
```
cd app
npm ci
npm test
cd ..
```

Build and run the Docker image:
```
docker build -t cicd-demo-app:local app
docker run --rm -p 4000:3000 cicd-demo-app:local
```

Access the application at `http://localhost:4000`.

## Kubernetes Verification

Check the cluster:
```
kubectl get nodes
```

Check the application:
```
kubectl get pods
kubectl get service
```

Access the application locally:
```
kubectl port-forward service/cicd-demo-app-service 8081:80
```

Then open `http://localhost:8081`.

## Jenkins Configuration

The Jenkins job uses:
- Definition: Pipeline script from SCM
- SCM: Git
- Branch: `main`
- Script Path: `Jenkinsfile`

Required Jenkins credentials:

| Credential ID            | Type                    | Purpose                     |
|---------------------------|--------------------------|-------------------------------|
| `dockerhub-credentials`   | Username with password  | Docker Hub authentication   |
| `kubeconfig-credentials`  | Secret file              | Kubernetes cluster access   |

Pipeline parameters:

| Parameter             | Default          |
|------------------------|-------------------|
| `K8S_NAMESPACE`         | `default`         |
| `IMAGE_NAME`            | `cicd-demo-app`   |
| `DOCKERHUB_USERNAME`    | `debugsnug`       |

## Production Improvements

Possible production extensions include:
- GitHub webhook integration with a publicly reachable Jenkins server
- Namespace-scoped Kubernetes RBAC
- Short-lived credentials
- Container image vulnerability scanning
- Centralized logging and monitoring (Prometheus and Grafana)
- Deployment notifications
