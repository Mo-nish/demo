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
        SONAR_TOKEN = 'sqp_6722f360d8d41d26f380967b3b80976e6b7d61ac'
        SONAR_HOST_URL = 'http://localhost:9000' // Update if SonarQube is on different port
        SONAR_PROJECT_KEY = 'Demo' // Project key in SonarQube
        // SonarQube installation name in Jenkins (leave empty to use direct connection)
        // Check your SonarQube installation name in: Manage Jenkins → Configure System → SonarQube servers
        // If you have 2 installations, set this to one of their names, or leave empty to skip withSonarQubeEnv
        SONAR_INSTALLATION_NAME = '' // Set to your SonarQube installation name, or leave empty
        
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
        
        stage('Install SonarQube Scanner for npm') {
            steps {
                script {
                    echo 'Installing SonarQube Scanner for npm (@sonar/scan)...'
                    // Install SonarQube Scanner for npm projects globally
                    // Using npx will work even if not globally installed, but global install is faster
                    sh 'npm install -g @sonar/scan || echo "Global install failed, will use npx instead"'
                    echo 'SonarQube Scanner installation completed (using npx sonar for execution)'
                }
            }
        }
        
        stage('SonarQube Analysis') {
            steps {
                echo 'Running SonarQube analysis with @sonar/scan...'
                script {
                    // Use withSonarQubeEnv if installation name is provided, otherwise use direct connection
                    if (env.SONAR_INSTALLATION_NAME && env.SONAR_INSTALLATION_NAME.trim()) {
                        echo "Using SonarQube installation: ${SONAR_INSTALLATION_NAME}"
                        withSonarQubeEnv("${SONAR_INSTALLATION_NAME}") {
                            sh """
                                npx sonar \\
                                    -Dsonar.projectKey=${SONAR_PROJECT_KEY} \\
                                    -Dsonar.host.url=${SONAR_HOST_URL} \\
                                    -Dsonar.token=${SONAR_TOKEN} \\
                                    -Dsonar.exclusions=node_modules/**,coverage/**,**/*.test.js \\
                                    -Dsonar.javascript.lcov.reportPaths=coverage/lcov.info \\
                                    -Dsonar.coverage.exclusions=**/*.test.js
                            """
                        }
                    } else {
                        echo "Using direct SonarQube connection (no installation name specified)"
                        sh """
                            npx sonar \\
                                -Dsonar.projectKey=${SONAR_PROJECT_KEY} \\
                                -Dsonar.host.url=${SONAR_HOST_URL} \\
                                -Dsonar.token=${SONAR_TOKEN} \\
                                -Dsonar.exclusions=node_modules/**,coverage/**,**/*.test.js \\
                                -Dsonar.javascript.lcov.reportPaths=coverage/lcov.info \\
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
                        def qg
                        // Use waitForQualityGate with installation name if provided
                        if (env.SONAR_INSTALLATION_NAME && env.SONAR_INSTALLATION_NAME.trim()) {
                            qg = waitForQualityGate(installationName: "${SONAR_INSTALLATION_NAME}")
                        } else {
                            // Use default waitForQualityGate (will use default installation or abortKey)
                            qg = waitForQualityGate(abortPipeline: true)
                        }
                        
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


