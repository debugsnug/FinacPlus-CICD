# Setup Instructions

## Prerequisites

The following tools are required (Windows):

- Git
- Node.js and npm
- Docker Desktop
- Kubernetes enabled in Docker Desktop
- kubectl
- Jenkins
- GitHub account
- Docker Hub account

Verify the installations:

```cmd
git --version
node --version
npm --version
docker --version
kubectl version --client
java -version
```

## 1. Repository Layout

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

## 2. Clone the Repository

```cmd
git clone https://github.com/debugsnug/FinacPlus-CICD.git
cd FinacPlus-CICD
```

## 3. Test the Application Locally

```cmd
cd app
npm ci
npm test
cd ..
```

## 4. Build and Run the Docker Image Locally

```cmd
docker build -t finacplus-cicd-demo:local app
docker run --rm -p 4000:3000 finacplus-cicd-demo:local
```

The application is available at `http://localhost:4000`.

## 5. Enable Kubernetes

Enable Kubernetes from Docker Desktop settings, then verify the cluster:

```cmd
kubectl cluster-info
kubectl get nodes
```

The node should report a `Ready` status.

## 6. Configure Jenkins Credentials

Go to: **Manage Jenkins → Credentials → System → Global credentials**

**Docker Hub** — create a `Username with password` credential:
```
ID: dockerhub-credentials
Username: <Docker Hub username>
Password: <Docker Hub Personal Access Token>
```

**Kubernetes** — create a `Secret file` credential:
```
ID: kubeconfig-credentials
File: <kubeconfig for the Docker Desktop cluster>
```

Credential values must never be committed to the repository.

## 7. Create the Jenkins Pipeline Job

1. New Item → Pipeline
2. Under **Pipeline**, choose "Pipeline script from SCM"
3. SCM: Git → repository: `https://github.com/debugsnug/FinacPlus-CICD.git`
4. Branch: `*/main`
5. Script Path: `Jenkinsfile`

## 8. Pipeline Parameters

| Parameter             | Default          |
|------------------------|-------------------|
| `K8S_NAMESPACE`         | `default`         |
| `IMAGE_NAME`            | `cicd-demo-app`   |
| `DOCKERHUB_USERNAME`    | `debugsnug`       |

## 9. Pipeline Stages

```
Checkout
   ↓
Verify Tools
   ↓
Install & Test
   ↓
Build Docker Image
   ↓
Push to Docker Hub
   ↓
Deploy to Kubernetes
   ↓
Verify Deployment
```

Docker images are tagged with the Jenkins build number:
```
debugsnug/cicd-demo-app:<BUILD_NUMBER>
```

## 10. Verify the Kubernetes Deployment

```cmd
kubectl get deployment cicd-demo-app
kubectl get pods
kubectl get service cicd-demo-app-service
```

The Deployment should report two available replicas.

To access the application locally:

```cmd
kubectl port-forward service/cicd-demo-app-service 8081:80
```

Then open `http://localhost:8081`.

## 11. CI/CD Validation

To validate the complete pipeline end to end:

1. Modify the application source code.
2. Commit the change.
3. Push the change to the `main` branch.
4. Run the Jenkins pipeline.
5. Verify a new Docker image is built and pushed.
6. Verify the Kubernetes rolling update completes.
7. Verify the updated application response.

## Security

- Docker Hub credentials are stored in Jenkins Credentials.
- Kubernetes credentials are stored in Jenkins Credentials.
- Kubernetes configuration files are excluded from Git.
- Environment files are excluded from Git.
- The Docker container runs as a non-root user.
- Docker registry sessions are logged out after pipeline execution.
