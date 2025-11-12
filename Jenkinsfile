pipeline {
    agent any
    
    environment {
        // Docker Registry Configuration
        // Note: Nexus Docker registry might be on port 8082 or 8083, not 8081
        // Port 8081 is typically for Nexus UI. Update if needed.
        DOCKER_REGISTRY = 'localhost:8081' // Change to 8082 or 8083 if Docker registry is on different port
        DOCKER_USERNAME = 'monish1999'
        DOCKER_PASSWORD = 'Monish@007'
        NEXUS_URL = 'http://localhost:8081/'
        NEXUS_USERNAME = 'admin'
        NEXUS_PASSWORD = 'Monish@007'
        
        // SonarQube Configuration
        SONAR_TOKEN = 'squ_f17e809711f9b6fd74857777abb29b6059efaed9'
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
                script {
                    // Check if test:coverage script exists, if not use test with coverage flag
                    def packageJson = readJSON file: 'package.json'
                    def hasCoverageScript = packageJson.scripts && packageJson.scripts['test:coverage']
                    
                    if (hasCoverageScript) {
                        sh 'npm run test:coverage'
                    } else {
                        echo 'test:coverage script not found, running jest with --coverage flag directly...'
                        sh 'npx jest --coverage'
                    }
                }
            }
            post {
                always {
                    // Publish coverage reports only if coverage directory exists
                    script {
                        def coverageExists = fileExists 'coverage/index.html'
                        if (coverageExists) {
                            publishHTML([
                                reportDir: 'coverage',
                                reportFiles: 'index.html',
                                reportName: 'Coverage Report'
                            ])
                        } else {
                            echo 'Coverage report not found, skipping HTML publish'
                        }
                    }
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
        
        stage('Quality Gate - 80% Coverage Required') {
            steps {
                echo 'Waiting for SonarQube Quality Gate (80% coverage required)...'
                script {
                    timeout(time: 5, unit: 'MINUTES') {
                        def qg = waitForQualityGate()
                        if (qg.status != 'OK') {
                            error """
                                ============================================
                                QUALITY GATE FAILED - Pipeline Stopped
                                ============================================
                                Status: ${qg.status}
                                Reason: Code coverage or quality metrics did not meet the 80% threshold
                                
                                The pipeline will NOT proceed to Docker/Nexus stages.
                                Please fix the code quality issues and try again.
                                ============================================
                            """
                        }
                        echo """
                            ============================================
                            QUALITY GATE PASSED ✓
                            ============================================
                            Status: ${qg.status}
                            Code coverage meets 80% requirement
                            Proceeding to Docker build and Nexus deployment...
                            ============================================
                        """
                    }
                }
            }
        }
        
        stage('Build Docker Image') {
            // This stage only runs if Quality Gate passed (pipeline continues on success)
            steps {
                echo '✓ Quality Gate passed! Building Docker image...'
                script {
                    sh """
                        docker build -t ${IMAGE_NAME}:${IMAGE_TAG} .
                        docker tag ${IMAGE_NAME}:${IMAGE_TAG} ${IMAGE_NAME}:latest
                    """
                }
            }
        }
        
        stage('Push to Nexus') {
            // This stage only runs if previous stages succeeded
            steps {
                echo 'Pushing Docker image to Nexus repository...'
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
            // This stage only runs if previous stages succeeded
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
            echo """
                ============================================
                ✓ PIPELINE COMPLETED SUCCESSFULLY
                ============================================
                ✓ Quality Gate passed (80% coverage met)
                ✓ Docker image built and pushed to Nexus
                ✓ Container deployed successfully
                ============================================
            """
        }
        failure {
            script {
                def failureStage = env.STAGE_NAME ?: 'Unknown'
                echo """
                    ============================================
                    ✗ PIPELINE FAILED
                    ============================================
                    Failed at stage: ${failureStage}
                    
                    If Quality Gate failed:
                    - Code coverage did not meet 80% requirement
                    - Fix code quality issues and try again
                    - Docker/Nexus stages were NOT executed
                    ============================================
                """
            }
        }
        always {
            echo 'Cleaning up temporary files...'
            // Clean up Docker images to save space (keep only if successful)
            sh 'docker image prune -f || true'
        }
    }
}

