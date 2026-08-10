pipeline {
    agent any

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
                    bat 'docker build -t "%FULL_IMAGE_NAME%" .'
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
                        @echo off

                        set "DOCKER_PASSWORD_FILE=%WORKSPACE%\\docker-password.txt"

                        >"%DOCKER_PASSWORD_FILE%" echo %DOCKER_PASSWORD%

                        docker login -u "%DOCKER_USERNAME%" --password-stdin < "%DOCKER_PASSWORD_FILE%"
                        if errorlevel 1 (
                            del /q "%DOCKER_PASSWORD_FILE%"
                            exit /b 1
                        )

                        docker push "%FULL_IMAGE_NAME%"
                        set "PUSH_RESULT=%ERRORLEVEL%"

                        del /q "%DOCKER_PASSWORD_FILE%"

                        exit /b %PUSH_RESULT%
                    '''
                }
            }
        }

        stage('Deploy to Kubernetes') {
            steps {
                withCredentials([
                    file(
                        credentialsId: 'kubeconfig-credentials',
                        variable: 'KUBECONFIG_FILE'
                    )
                ]) {
                    bat '''
                        @echo off

                        echo Rendering Kubernetes deployment manifest...
                        powershell -NoProfile -ExecutionPolicy Bypass -Command "(Get-Content 'k8s/deployment.yaml') -replace 'IMAGE_PLACEHOLDER', '%FULL_IMAGE_NAME%' | Set-Content 'k8s/deployment-rendered.yaml'"

                        echo Applying deployment...
                        kubectl --kubeconfig="%KUBECONFIG_FILE%" apply -f k8s/deployment-rendered.yaml -n "%K8S_NAMESPACE%"

                        echo Applying service...
                        kubectl --kubeconfig="%KUBECONFIG_FILE%" apply -f k8s/service.yaml -n "%K8S_NAMESPACE%"

                        echo Waiting for rollout...
                        kubectl --kubeconfig="%KUBECONFIG_FILE%" rollout status deployment/cicd-demo-app -n "%K8S_NAMESPACE%" --timeout=120s

                        echo Kubernetes rollout completed successfully.
                    '''
                }
            }
        }

        stage('Verify Deployment') {
            steps {
                withCredentials([
                    file(
                        credentialsId: 'kubeconfig-credentials',
                        variable: 'KUBECONFIG_FILE'
                    )
                ]) {
                    bat '''
                        @echo off

                        echo ===== Deployment =====
                        kubectl --kubeconfig="%KUBECONFIG_FILE%" get deployment cicd-demo-app -n "%K8S_NAMESPACE%"

                        echo ===== Pods =====
                        kubectl --kubeconfig="%KUBECONFIG_FILE%" get pods -n "%K8S_NAMESPACE%" -l app=cicd-demo-app

                        echo ===== Service =====
                        kubectl --kubeconfig="%KUBECONFIG_FILE%" get service cicd-demo-app-service -n "%K8S_NAMESPACE%"
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
            echo 'Pipeline failed. Check the failed stage for details.'
        }

        always {
            bat '''
                @echo off
                if exist "%WORKSPACE%\\docker-password.txt" del /q "%WORKSPACE%\\docker-password.txt"
                docker logout >nul 2>&1
                exit /b 0
            '''
        }
    }
}