pipeline {
    agent any

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
            name: 'DOCKERHUB_USERNAME',
            defaultValue: 'debugsnug',
            description: 'Docker Hub username'
        )
    }

    environment {
        IMAGE_TAG = "${BUILD_NUMBER}"

        FULL_IMAGE_NAME = "${params.DOCKERHUB_USERNAME}/${params.IMAGE_NAME}:${BUILD_NUMBER}"
    }

    options {
        timestamps()

        buildDiscarder(
            logRotator(numToKeepStr: '15')
        )

        timeout(
            time: 20,
            unit: 'MINUTES'
        )
    }

    stages {

        stage('Checkout') {
            steps {
                echo 'Checking out source code from GitHub...'

                checkout scm
            }
        }

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

        stage('Install & Test') {
            steps {
                dir('app') {

                    echo 'Installing dependencies...'

                    bat 'npm ci'

                    echo 'Running automated tests...'

                    bat 'npm test'
                }
            }
        }

        stage('Build Docker Image') {
            steps {
                dir('app') {

                    echo "Building Docker image: ${FULL_IMAGE_NAME}"

                    bat "docker build -t ${FULL_IMAGE_NAME} ."
                }
            }
        }

        stage('Push to Docker Hub') {
            steps {

                echo "Pushing ${FULL_IMAGE_NAME} to Docker Hub..."

                withCredentials([
                    usernamePassword(
                        credentialsId: 'dockerhub-credentials',
                        usernameVariable: 'DOCKER_USERNAME',
                        passwordVariable: 'DOCKER_PASSWORD'
                    )
                ]) {

                    bat '''
                        echo Logging in to Docker Hub...

                        docker login -u "%DOCKER_USERNAME%" -p "%DOCKER_PASSWORD%"

                        echo Pushing Docker image...

                        docker push "%FULL_IMAGE_NAME%"

                        echo Docker image pushed successfully.
                    '''
                }
            }
        }

        stage('Deploy to Kubernetes') {
            steps {

                withCredentials([
                    file(
                        credentialsId: 'kubeconfig-credentials',
                        variable: 'KUBECONFIG'
                    )
                ]) {

                    echo "Deploying ${FULL_IMAGE_NAME} to Kubernetes..."

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

                        Write-Host "Applying deployment..."

                        kubectl apply `
                            -f $renderedFile `
                            -n $env:K8S_NAMESPACE

                        Write-Host "Applying service..."

                        kubectl apply `
                            -f k8s/service.yaml `
                            -n $env:K8S_NAMESPACE

                        Write-Host "Waiting for rollout..."

                        kubectl rollout status `
                            deployment/cicd-demo-app `
                            -n $env:K8S_NAMESPACE `
                            --timeout=120s

                        Write-Host "Kubernetes rollout completed successfully."
                    '''
                }
            }
        }

        stage('Verify Deployment') {
            steps {

                withCredentials([
                    file(
                        credentialsId: 'kubeconfig-credentials',
                        variable: 'KUBECONFIG'
                    )
                ]) {

                    powershell '''
                        Write-Host "===== Deployment ====="

                        kubectl get deployment `
                            cicd-demo-app `
                            -n $env:K8S_NAMESPACE

                        Write-Host "===== Pods ====="

                        kubectl get pods `
                            -l app=cicd-demo-app `
                            -n $env:K8S_NAMESPACE

                        Write-Host "===== Service ====="

                        kubectl get service `
                            cicd-demo-app-service `
                            -n $env:K8S_NAMESPACE
                    '''
                }
            }
        }
    }

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
            Check the failed stage and console logs.
            ==========================================
            """
        }

        always {

            powershell '''
                if (Test-Path "k8s/deployment-rendered.yaml") {
                    Remove-Item "k8s/deployment-rendered.yaml" -Force
                }
            '''

            bat '''
                docker logout >nul 2>&1
                exit /b 0
            '''
        }
    }
}