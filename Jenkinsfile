pipeline {
    agent any

    /*
     * Automatically trigger the pipeline when GitHub sends
     * a push event to Jenkins.
     *
     * Requires:
     *  - GitHub plugin
     *  - GitHub webhook configured for this Jenkins server
     */
    triggers {
        githubPush()
    }

    parameters {
        string(
            name: 'K8S_NAMESPACE',
            defaultValue: 'default',
            description: 'Kubernetes namespace for deployment'
        )

        string(
            name: 'IMAGE_NAME',
            defaultValue: 'cicd-demo-app',
            description: 'Docker image name'
        )

        string(
            name: 'GCP_PROJECT_ID',
            defaultValue: 'your-gcp-project-id',
            description: 'Google Cloud project ID'
        )

        string(
            name: 'GCP_ARTIFACT_REPOSITORY',
            defaultValue: 'finacplus-repo',
            description: 'Google Artifact Registry repository name'
        )

        string(
            name: 'REGISTRY_HOST',
            defaultValue: 'asia-south1-docker.pkg.dev',
            description: 'Google Artifact Registry hostname'
        )
    }

    environment {
        /*
         * Image tag is generated automatically from the Jenkins build number.
         * Example:
         *
         * asia-south1-docker.pkg.dev/my-project/finacplus-repo/cicd-demo-app:12
         */
        IMAGE_TAG = "${BUILD_NUMBER}"

        FULL_IMAGE_NAME = "${params.REGISTRY_HOST}/${params.GCP_PROJECT_ID}/${params.GCP_ARTIFACT_REPOSITORY}/${params.IMAGE_NAME}:${BUILD_NUMBER}"
    }

    options {
        timestamps()

        /*
         * Keep only the latest 15 builds.
         */
        buildDiscarder(
            logRotator(numToKeepStr: '15')
        )

        /*
         * Prevent a stuck build from running forever.
         */
        timeout(
            time: 20,
            unit: 'MINUTES'
        )
    }

    stages {

        /*
         * ---------------------------------------------------------
         * STAGE 1: CHECKOUT
         * ---------------------------------------------------------
         */
        stage('Checkout') {
            steps {
                echo 'Checking out source code from GitHub...'

                checkout scm
            }
        }

        /*
         * ---------------------------------------------------------
         * STAGE 2: VERIFY TOOLS
         * ---------------------------------------------------------
         *
         * This is especially useful on our Windows Jenkins agent.
         * It immediately tells us if Jenkins can see the tools it needs.
         */
        stage('Verify Tools') {
            steps {
                echo 'Verifying required tools...'

                bat '''
                    echo ===== Java =====
                    java -version

                    echo ===== Node.js =====
                    node --version

                    echo ===== npm =====
                    npm --version

                    echo ===== Git =====
                    git --version

                    echo ===== Docker =====
                    docker --version

                    echo ===== kubectl =====
                    kubectl version --client
                '''
            }
        }

        /*
         * ---------------------------------------------------------
         * STAGE 3: INSTALL & TEST
         * ---------------------------------------------------------
         */
        stage('Install & Test') {
            steps {
                dir('app') {

                    echo 'Installing dependencies using npm ci...'

                    bat 'npm ci'

                    echo 'Running automated tests...'

                    bat 'npm test'
                }
            }
        }

        /*
         * ---------------------------------------------------------
         * STAGE 4: BUILD DOCKER IMAGE
         * ---------------------------------------------------------
         */
        stage('Build Docker Image') {
            steps {
                dir('app') {

                    echo "Building Docker image: ${FULL_IMAGE_NAME}"

                    bat "docker build -t ${FULL_IMAGE_NAME} ."
                }
            }
        }

        /*
         * ---------------------------------------------------------
         * STAGE 5: PUSH TO GOOGLE ARTIFACT REGISTRY
         * ---------------------------------------------------------
         *
         * Credentials are retrieved from Jenkins Credentials Store.
         * No service-account key is stored in GitHub.
         */
        stage('Push Docker Image') {
            steps {

                withCredentials([
                    file(
                        credentialsId: 'gcp-service-account-key',
                        variable: 'GCP_SA_KEY'
                    )
                ]) {

                    bat '''
                        echo Authenticating with Google Cloud...

                        gcloud auth activate-service-account --key-file="%GCP_SA_KEY%"

                        echo Configuring Docker authentication...

                        gcloud auth configure-docker %REGISTRY_HOST% --quiet

                        echo Pushing Docker image...

                        docker push %FULL_IMAGE_NAME%
                    '''
                }
            }
        }

        /*
         * ---------------------------------------------------------
         * STAGE 6: DEPLOY TO KUBERNETES
         * ---------------------------------------------------------
         */
        stage('Deploy to Kubernetes') {
            steps {

                withCredentials([
                    file(
                        credentialsId: 'kubeconfig-credentials',
                        variable: 'KUBECONFIG'
                    )
                ]) {

                    echo "Deploying ${FULL_IMAGE_NAME} to Kubernetes..."

                    /*
                     * PowerShell is used because Jenkins is running on Windows.
                     *
                     * IMAGE_PLACEHOLDER in deployment.yaml is replaced
                     * with the exact Docker image generated by this build.
                     */
                    powershell '''
                        $deploymentFile = "k8s/deployment.yaml"
                        $renderedFile = "k8s/deployment-rendered.yaml"

                        Write-Host "Rendering Kubernetes deployment manifest..."

                        $content = Get-Content $deploymentFile -Raw

                        $content = $content -replace `
                            "IMAGE_PLACEHOLDER", `
                            $env:FULL_IMAGE_NAME

                        Set-Content `
                            -Path $renderedFile `
                            -Value $content

                        Write-Host "Applying Kubernetes deployment..."

                        kubectl apply `
                            -f $renderedFile `
                            -n $env:K8S_NAMESPACE

                        Write-Host "Applying Kubernetes service..."

                        kubectl apply `
                            -f k8s/service.yaml `
                            -n $env:K8S_NAMESPACE

                        Write-Host "Waiting for Kubernetes rollout..."

                        kubectl rollout status `
                            deployment/cicd-demo-app `
                            -n $env:K8S_NAMESPACE `
                            --timeout=120s

                        Write-Host "Kubernetes rollout completed successfully."
                    '''
                }
            }
        }

        /*
         * ---------------------------------------------------------
         * STAGE 7: VERIFY DEPLOYMENT
         * ---------------------------------------------------------
         */
        stage('Verify Deployment') {
            steps {

                withCredentials([
                    file(
                        credentialsId: 'kubeconfig-credentials',
                        variable: 'KUBECONFIG'
                    )
                ]) {

                    powershell '''
                        Write-Host "===== Kubernetes Deployment ====="

                        kubectl get deployment `
                            cicd-demo-app `
                            -n $env:K8S_NAMESPACE

                        Write-Host "===== Kubernetes Pods ====="

                        kubectl get pods `
                            -l app=cicd-demo-app `
                            -n $env:K8S_NAMESPACE

                        Write-Host "===== Kubernetes Service ====="

                        kubectl get service `
                            cicd-demo-app-service `
                            -n $env:K8S_NAMESPACE
                    '''
                }
            }
        }
    }

    /*
     * -------------------------------------------------------------
     * POST-BUILD HANDLING
     * -------------------------------------------------------------
     */
    post {

        success {
            echo """
            ==========================================
            CI/CD PIPELINE SUCCESSFUL
            ==========================================
            Image: ${FULL_IMAGE_NAME}
            Namespace: ${params.K8S_NAMESPACE}
            Deployment: cicd-demo-app
            ==========================================
            """
        }

        failure {
            echo """
            ==========================================
            CI/CD PIPELINE FAILED
            ==========================================
            Check the failed stage and console logs
            above for the root cause.
            ==========================================
            """
        }

        always {

            /*
             * Remove the temporary rendered Kubernetes manifest.
             */
            powershell '''
                if (Test-Path "k8s/deployment-rendered.yaml") {
                    Remove-Item "k8s/deployment-rendered.yaml" -Force
                }
            '''

            /*
             * Revoke Google Cloud authentication if gcloud
             * is available. Failure of cleanup must not change
             * the actual pipeline result.
             */
            bat '''
                gcloud auth revoke --all --quiet >nul 2>&1
                exit /b 0
            '''
        }
    }
}