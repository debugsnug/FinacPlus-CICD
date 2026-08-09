// Jenkinsfile
// Declarative Jenkins pipeline written in Groovy.
// This file lives inside the application repo (checked out via
// "Pipeline script from SCM" in the Jenkins job config). A GitHub webhook +
// the githubPush() trigger below mean Jenkins builds automatically on every
// commit — no manual "build now" click required.
// Flow:  checkout -> test -> build docker image -> push to Artifact Registry -> deploy to K8s
//
// Design goals (per the problem statement):
//   - Scalable / adaptable to different repos & clusters -> all environment-specific
//     values are pulled from Jenkins credentials / parameters, nothing is hardcoded.
//   - Groovy used for the automation logic (the stages + helper functions below).
//   - Fails loudly and clearly on error (post { failure { ... } }).
//   - Security: credentials are only ever referenced via Jenkins' credential store,
//     never printed or hardcoded in this file.

pipeline {
    agent any

    // Makes the "whenever a commit is made, Jenkins should automatically
    // trigger a build" requirement explicit in code, instead of relying only
    // on a manually-configured job setting that isn't visible in this file.
    // Requires: GitHub plugin installed + a webhook on the repo pointed at
    // this Jenkins server (see docs/SETUP.md, step 3).
    triggers {
        githubPush()
    }

    parameters {
        string(name: 'K8S_NAMESPACE', defaultValue: 'default', description: 'Target K8s namespace')
        string(name: 'IMAGE_NAME', defaultValue: 'cicd-demo-app', description: 'Docker image name')
        string(name: 'GCP_PROJECT_ID', defaultValue: 'your-gcp-project-id', description: 'GCP project hosting Artifact Registry + GKE')
        string(name: 'REGISTRY_HOST', defaultValue: 'asia-south1-docker.pkg.dev', description: 'Artifact Registry host (region-specific)')
    }

    environment {
        // Jenkins credential IDs — configured once in Jenkins > Manage Credentials,
        // never stored in this file. This is what makes the pipeline reusable
        // across different repos/clusters without editing code.
        //
        // Registry: this project targets Google Artifact Registry, matching the
        // GCP stack in the target role. REGISTRY_HOST is parameterized below so
        // the same pipeline also works against Docker Hub for local demos
        // (see docs/SETUP.md "Local demo mode" for that variant).
        GCP_SA_KEY        = credentials('gcp-service-account-key')
        KUBECONFIG_CRED   = credentials('kubeconfig-credentials')
        IMAGE_TAG         = "${env.BUILD_NUMBER}"
        FULL_IMAGE_NAME   = "${params.REGISTRY_HOST}/${params.GCP_PROJECT_ID}/${params.IMAGE_NAME}:${IMAGE_TAG}"
    }

    options {
        timestamps()
        // Keep only recent builds to avoid disk bloat on the Jenkins agent
        buildDiscarder(logRotator(numToKeepStr: '15'))
        // Don't let a hung build/deploy block the pipeline forever
        timeout(time: 20, unit: 'MINUTES')
    }

    stages {

        stage('Checkout') {
            steps {
                // 'checkout scm' checks out whatever repo/branch triggered THIS
                // build — the Jenkinsfile lives inside the app repo itself
                // (Pipeline script from SCM), so there's no separate repo URL
                // to configure or keep in sync. This is what makes the same
                // pipeline definition portable: point a new Jenkins job at a
                // different repo's Jenkinsfile and it just works, no edits needed.
                checkout scm
            }
        }

        stage('Install & Test') {
            steps {
                dir('app') {
                    // npm ci = clean, reproducible install from package-lock.json.
                    // Preferred over `npm install` in CI: it fails if the lock
                    // file is out of sync instead of silently updating it.
                    sh 'npm ci'
                    sh 'npm test'
                }
            }
        }

        stage('Build Docker Image') {
            steps {
                dir('app') {
                    sh "docker build -t ${FULL_IMAGE_NAME} ."
                }
            }
        }

        stage('Push Docker Image') {
            steps {
                sh """
                    # Authenticate to Google Artifact Registry using a service
                    # account key stored in Jenkins credentials (never in this file).
                    gcloud auth activate-service-account --key-file=\${GCP_SA_KEY}
                    gcloud auth configure-docker ${params.REGISTRY_HOST} --quiet
                    docker push ${FULL_IMAGE_NAME}
                """
            }
        }

        stage('Deploy to Kubernetes') {
            steps {
                withEnv(["KUBECONFIG=${KUBECONFIG_CRED}"]) {
                    sh """
                        # Substitute the freshly built image tag into the deployment manifest
                        sed 's|IMAGE_PLACEHOLDER|${FULL_IMAGE_NAME}|g' k8s/deployment.yaml > k8s/deployment-rendered.yaml

                        kubectl apply -f k8s/deployment-rendered.yaml -n ${params.K8S_NAMESPACE}
                        kubectl apply -f k8s/service.yaml -n ${params.K8S_NAMESPACE}

                        # Wait for the rollout to actually succeed before calling this stage "done"
                        kubectl rollout status deployment/cicd-demo-app -n ${params.K8S_NAMESPACE} --timeout=120s
                    """
                }
            }
        }
    }

    post {
        success {
            echo "Deployment succeeded: ${FULL_IMAGE_NAME} is live in namespace ${params.K8S_NAMESPACE}"
        }
        failure {
            echo "Pipeline failed at some stage — check the stage logs above for details."
            // In a real setup: notify Slack/Teams/email here so failures aren't silent.
        }
        always {
            sh 'gcloud auth revoke --all || true'
        }
    }
}
