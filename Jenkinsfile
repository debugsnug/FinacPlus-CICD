pipeline {
    agent any

    triggers {
        githubPush()
    }

    parameters {
        string(
            name: 'K8S_NAMESPACE',
            defaultValue: 'default',
            description: 'Kubernetes namespace'
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
        FULL_IMAGE_NAME = "${params.DOCKERHUB_USERNAME}/${params.IMAGE_NAME}:${BUILD_NUMBER}"
    }

    options {
        timestamps()
        buildDiscarder(logRotator(numToKeepStr: '15'))
        timeout(time: 20, unit: 'MINUTES')
    }

    stages {

        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Verify Tools') {
            steps {
                bat '''
                    java -version
                    node --version
                    npm --version
                    git --version
                    docker --version
                    kubectl version --client
                '''
            }
        }

        stage('Install & Test') {
            steps {
                dir('app') {
                    bat 'npm ci'
                    bat 'npm test'
                }
            }
        }

        stage('Build Docker Image') {
            steps {
                dir('app') {
                    bat "docker build -t ${FULL_IMAGE_NAME} ."
                }
            }
        }

        stage('Push to Docker Hub') {
            steps {
                withCredentials([
                    usernamePassword(
                        credentialsId: 'dockerhub-credentials',
                        usernameVariable: 'DOCKER_USERNAME',
                        passwordVariable: 'DOCKER_PASSWORD'
                    )
                ]) {
                    bat '''
                        echo %DOCKER_PASSWORD% | docker login -u "%DOCKER_USERNAME%" --password-stdin
                        docker push "%FULL_IMAGE_NAME%"
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
                    powershell '''
                        $deploymentFile = "k8s/deployment.yaml"
                        $renderedFile = "k8s/deployment-rendered.yaml"

                        $content = Get-Content $deploymentFile -Raw
                        $content = $content -replace "IMAGE_PLACEHOLDER", $env:FULL_IMAGE_NAME
                        Set-Content -Path $renderedFile -Value $content

                        kubectl apply -f $renderedFile -n $env:K8S_NAMESPACE
                        kubectl apply -f k8s/service.yaml -n $env:K8S_NAMESPACE

                        kubectl rollout status deployment/cicd-demo-app -n $env:K8S_NAMESPACE --timeout=120s
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
                        kubectl get deployment cicd-demo-app -n $env:K8S_NAMESPACE
                        kubectl get pods -l app=cicd-demo-app -n $env:K8S_NAMESPACE
                        kubectl get service cicd-demo-app-service -n $env:K8S_NAMESPACE
                    '''
                }
            }
        }
    }

    post {
        success {
            echo "Deployment successful: ${FULL_IMAGE_NAME}"
        }

        failure {
            echo "Pipeline failed. Check the failed stage for details."
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