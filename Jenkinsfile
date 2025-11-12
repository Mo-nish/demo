pipeline {
    agent any
    
    environment {
        DOCKER_REGISTRY = 'localhost:8081' 
        DOCKER_USERNAME = 'monish1999'
        DOCKER_PASSWORD = credentials('docker-password') // Store Monish@007 as secret
        NEXUS_URL = 'http://localhost:8081/'
        NEXUS_USERNAME = 'admin'
        NEXUS_PASSWORD = credentials('nexus-password') // Store Monish@007 as secret
        
        // SonarQube Configuration
        SONAR_TOKEN = credentials('sonar-token') // Store your SonarQube token
        SONAR_HOST_URL = 'http://localhost:9000' // Update if SonarQube is on different port
        SONAR_PROJECT_KEY = 'sqp_6722f360d8d41d26f380967b3b80976e6b7d61ac' // Demo project
        
        // Image Configuration
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
                sh 'npm run test:coverage'
            }
            post {
                always {
                    // Publish coverage reports
                    publishHTML([
                        reportDir: 'coverage',
                        reportFiles: 'index.html',
                        reportName: 'Coverage Report'
                    ])
                }
            }
        }
        
        stage('Install SonarScanner') {
            steps {
                script {
                    echo 'Installing SonarScanner...'
                    // Check if SonarScanner is already installed
                    def sonarScannerInstalled = sh(
                        script: 'which sonar-scanner || echo "not found"',
                        returnStdout: true
                    ).trim()
                    
                    if (sonarScannerInstalled == 'not found') {
                        echo 'SonarScanner not found. Installing...'
                        // Install SonarScanner
                        sh '''
                            wget https://binaries.sonarsource.com/Distribution/sonar-scanner-cli/sonar-scanner-cli-5.0.1.3006-linux.zip -O /tmp/sonar-scanner.zip
                            unzip -q /tmp/sonar-scanner.zip -d /tmp/
                            sudo mv /tmp/sonar-scanner-5.0.1.3006-linux /opt/sonar-scanner
                            sudo ln -s /opt/sonar-scanner/bin/sonar-scanner /usr/local/bin/sonar-scanner
                            rm /tmp/sonar-scanner.zip
                        '''
                    } else {
                        echo 'SonarScanner already installed'
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
                echo 'Waiting for Quality Gate...'
                script {
                    timeout(time: 5, unit: 'MINUTES') {
                        def qg = waitForQualityGate()
                        if (qg.status != 'OK') {
                            error "Quality Gate failed: ${qg.status}"
                        }
                        echo "Quality Gate passed: ${qg.status}"
                    }
                }
            }
        }
        
        stage('Build Docker Image') {
            steps {
                echo 'Building Docker image...'
                script {
                    sh """
                        docker build -t ${IMAGE_NAME}:${IMAGE_TAG} .
                        docker tag ${IMAGE_NAME}:${IMAGE_TAG} ${IMAGE_NAME}:latest
                    """
                }
            }
        }
        
        stage('Push to Nexus') {
            steps {
                echo 'Pushing Docker image to Nexus...'
                script {
                    sh """
                        docker login -u ${DOCKER_USERNAME} -p ${DOCKER_PASSWORD} ${DOCKER_REGISTRY}
                        docker tag ${IMAGE_NAME}:${IMAGE_TAG} ${DOCKER_REGISTRY}/${NEXUS_REPO}/${IMAGE_NAME}:${IMAGE_TAG}
                        docker tag ${IMAGE_NAME}:${IMAGE_TAG} ${DOCKER_REGISTRY}/${NEXUS_REPO}/${IMAGE_NAME}:latest
                        docker push ${DOCKER_REGISTRY}/${NEXUS_REPO}/${IMAGE_NAME}:${IMAGE_TAG}
                        docker push ${DOCKER_REGISTRY}/${NEXUS_REPO}/${IMAGE_NAME}:latest
                    """
                }
            }
        }
        
        stage('Deploy Docker Container') {
            steps {
                echo 'Deploying Docker container...'
                script {
                    sh """
                        # Stop and remove existing container if it exists
                        docker stop ${IMAGE_NAME} || true
                        docker rm ${IMAGE_NAME} || true
                        
                        # Pull the latest image from Nexus
                        docker pull ${DOCKER_REGISTRY}/${NEXUS_REPO}/${IMAGE_NAME}:${IMAGE_TAG}
                        
                        # Run the new container
                        docker run -d \\
                            --name ${IMAGE_NAME} \\
                            -p 3000:3000 \\
                            --restart unless-stopped \\
                            ${DOCKER_REGISTRY}/${NEXUS_REPO}/${IMAGE_NAME}:${IMAGE_TAG}
                    """
                }
            }
        }
    }
    
    post {
        success {
            echo 'Pipeline completed successfully!'
            // Optional: Send notifications
        }
        failure {
            echo 'Pipeline failed!'
            // Optional: Send failure notifications
        }
        always {
            echo 'Cleaning up...'
            // Clean up Docker images to save space
            sh 'docker image prune -f || true'
        }
    }
}


