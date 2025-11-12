pipeline {
    agent any

    environment {
        DOCKER_REGISTRY = 'localhost:8081'
        DOCKER_USERNAME = 'monish1999'
        DOCKER_PASSWORD = 'Monish@007'
        NEXUS_URL = 'http://localhost:8081/'
        NEXUS_USERNAME = 'admin'
        NEXUS_PASSWORD = 'Monish@007'

        SONAR_TOKEN = 'squ_f17e809711f9b6fd74857777abb29b6059efaed9'
        SONAR_HOST_URL = 'http://localhost:9000'
        SONAR_PROJECT_KEY = 'sqp_6722f360d8d41d26f380967b3b80976e6b7d61ac'

        IMAGE_NAME = 'test-app'
        IMAGE_TAG = "${env.BUILD_NUMBER}"
        NEXUS_REPO = 'docker-local'
    }

    stages {
        stage('Checkout') {
            steps {
                echo 'Checking out code...'
                checkout scm
            }
        }

        stage('Install Dependencies') {
            steps {
                echo 'Installing Node.js dependencies...'
                sh 'npm install'
            }
        }

        stage('Run Tests') {
            steps {
                echo 'Running tests with coverage...'
                // fallback if no test:coverage script exists
                script {
                    def pkg = readJSON file: 'package.json'
                    if (pkg.scripts && pkg.scripts['test:coverage']) {
                        sh 'npm run test:coverage'
                    } else {
                        echo 'No test:coverage script found, running default test...'
                        sh 'npm test'
                    }
                }
            }
            post {
                always {
                    echo 'Publishing HTML coverage report (if plugin installed)...'
                    script {
                        try {
                            publishHTML([
                                reportDir: 'coverage',
                                reportFiles: 'index.html',
                                reportName: 'Coverage Report'
                            ])
                        } catch (e) {
                            echo "Skipping publishHTML (plugin missing): ${e}"
                        }
                    }
                }
            }
        }

        stage('SonarQube Analysis') {
            steps {
                echo 'Running SonarQube analysis...'
                script {
                    withSonarQubeEnv('SonarQube') {
                        sh """
                            sonar-scanner \
                                -Dsonar.projectKey=${SONAR_PROJECT_KEY} \
                                -Dsonar.sources=. \
                                -Dsonar.host.url=${SONAR_HOST_URL} \
                                -Dsonar.login=${SONAR_TOKEN} \
                                -Dsonar.exclusions=node_modules/**,coverage/**,**/*.test.js \
                                -Dsonar.javascript.lcov.reportPaths=coverage/lcov.info \
                                -Dsonar.coverage.exclusions=**/*.test.js
                        """
                    }
                }
            }
        }

        stage('Quality Gate') {
            steps {
                echo 'Waiting for SonarQube Quality Gate result...'
                timeout(time: 5, unit: 'MINUTES') {
                    def qg = waitForQualityGate()
                    if (qg.status != 'OK') {
                        error "QUALITY GATE FAILED: ${qg.status}"
                    }
                }
            }
        }

        stage('Build Docker Image') {
            steps {
                echo 'Building Docker image...'
                sh """
                    docker build -t ${IMAGE_NAME}:${IMAGE_TAG} .
                    docker tag ${IMAGE_NAME}:${IMAGE_TAG} ${IMAGE_NAME}:latest
                """
            }
        }

        stage('Push to Nexus') {
            steps {
                echo 'Pushing Docker image to Nexus...'
                sh """
                    docker login -u ${DOCKER_USERNAME} -p ${DOCKER_PASSWORD} ${DOCKER_REGISTRY}
                    docker tag ${IMAGE_NAME}:${IMAGE_TAG} ${DOCKER_REGISTRY}/${NEXUS_REPO}/${IMAGE_NAME}:${IMAGE_TAG}
                    docker tag ${IMAGE_NAME}:${IMAGE_TAG} ${DOCKER_REGISTRY}/${NEXUS_REPO}/${IMAGE_NAME}:latest
                    docker push ${DOCKER_REGISTRY}/${NEXUS_REPO}/${IMAGE_NAME}:${IMAGE_TAG}
                    docker push ${DOCKER_REGISTRY}/${NEXUS_REPO}/${IMAGE_NAME}:latest
                """
            }
        }

        stage('Deploy Container') {
            steps {
                echo 'Deploying container...'
                sh """
                    docker stop ${IMAGE_NAME} || true
                    docker rm ${IMAGE_NAME} || true
                    docker run -d --name ${IMAGE_NAME} -p 3000:3000 ${DOCKER_REGISTRY}/${NEXUS_REPO}/${IMAGE_NAME}:${IMAGE_TAG}
                """
            }
        }
    }

    post {
        always {
            echo 'Cleaning up temporary Docker images...'
            node {
                sh 'docker image prune -f || true'
            }
        }
        success {
            echo '✅ PIPELINE COMPLETED SUCCESSFULLY'
        }
        failure {
            echo '❌ PIPELINE FAILED — Check above logs for the failing stage.'
        }
    }
}

