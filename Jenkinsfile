pipeline {
    agent any
    
    environment {
        // Docker Hub Configuration
        DOCKER_HUB_USERNAME = 'monish1999'
        DOCKER_HUB_PASSWORD = 'Monish@007'
        DOCKER_HUB_REGISTRY = 'docker.io' // Docker Hub registry
        
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
        DOCKER_HUB_IMAGE = "${DOCKER_HUB_USERNAME}/${IMAGE_NAME}" // Full Docker Hub image path
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
                    // Always use withSonarQubeEnv wrapper (required for waitForQualityGate)
                    // If no installation name is set, try to use default or create a minimal wrapper
                    def installationName = env.SONAR_INSTALLATION_NAME && env.SONAR_INSTALLATION_NAME.trim() ? "${SONAR_INSTALLATION_NAME}" : 'SonarQube'
                    
                    try {
                        echo "Using SonarQube installation: ${installationName}"
                        withSonarQubeEnv("${installationName}") {
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
                    } catch (Exception e) {
                        echo "Warning: Could not use withSonarQubeEnv with '${installationName}'. Error: ${e.message}"
                        echo "Running analysis directly and will check quality gate via API..."
                        // Run analysis directly
                        def analysisOutput = sh(
                            script: """
                                npx sonar \\
                                    -Dsonar.projectKey=${SONAR_PROJECT_KEY} \\
                                    -Dsonar.host.url=${SONAR_HOST_URL} \\
                                    -Dsonar.token=${SONAR_TOKEN} \\
                                    -Dsonar.exclusions=node_modules/**,coverage/**,**/*.test.js \\
                                    -Dsonar.javascript.lcov.reportPaths=coverage/lcov.info \\
                                    -Dsonar.coverage.exclusions=**/*.test.js
                            """,
                            returnStdout: true
                        ).trim()
                        
                        // Store flag that we need to check quality gate via API
                        env.SONAR_ANALYSIS_DIRECT = 'true'
                        
                        // Check if quality gate passed in the output
                        if (analysisOutput.contains('QUALITY GATE STATUS: PASSED')) {
                            echo 'Quality Gate PASSED (verified from analysis output)'
                            env.SONAR_QUALITY_GATE_PASSED = 'true'
                        } else if (analysisOutput.contains('QUALITY GATE STATUS: FAILED')) {
                            error 'Quality Gate FAILED - Pipeline stopped'
                        }
                    }
                }
            }
        }
        
        stage('Quality Gate - 80% Coverage Required') {
            steps {
                echo 'Waiting for SonarQube Quality Gate (80% coverage required)...'
                script {
                    // If analysis was run directly (not in withSonarQubeEnv), check via API or use stored result
                    if (env.SONAR_ANALYSIS_DIRECT == 'true') {
                        if (env.SONAR_QUALITY_GATE_PASSED == 'true') {
                            echo """
                                ============================================
                                QUALITY GATE PASSED ✓
                                ============================================
                                Status: OK (verified from analysis output)
                                Code coverage meets 80% requirement
                                Proceeding to Docker build and Nexus deployment...
                                ============================================
                            """
                        } else {
                            // Check quality gate via SonarQube API (Windows-compatible)
                            echo 'Checking quality gate status via SonarQube API...'
                            def qgResponse = sh(
                                script: """
                                    powershell -Command "Invoke-RestMethod -Uri '${SONAR_HOST_URL}/api/qualitygates/project_status?projectKey=${SONAR_PROJECT_KEY}' -Headers @{Authorization=('Basic ' + [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes('${SONAR_TOKEN}:')))} | ConvertTo-Json"
                                """,
                                returnStdout: true
                            ).trim()
                            
                            // Parse JSON response to get status
                            def qgStatus = 'UNKNOWN'
                            if (qgResponse.contains('"status"')) {
                                def statusMatch = qgResponse =~ /"status"\s*:\s*"([^"]+)"/
                                if (statusMatch) {
                                    qgStatus = statusMatch[0][1]
                                }
                            }
                            
                            if (qgStatus != 'OK') {
                                error """
                                    ============================================
                                    QUALITY GATE FAILED - Pipeline Stopped
                                    ============================================
                                    Status: ${qgStatus}
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
                                Status: ${qgStatus}
                                Code coverage meets 80% requirement
                                Proceeding to Docker build and Nexus deployment...
                                ============================================
                            """
                        }
                    } else {
                        // Analysis was run in withSonarQubeEnv, use waitForQualityGate
                        timeout(time: 5, unit: 'MINUTES') {
                            def qg
                            def installationName = env.SONAR_INSTALLATION_NAME && env.SONAR_INSTALLATION_NAME.trim() ? "${SONAR_INSTALLATION_NAME}" : 'SonarQube'
                            
                            try {
                                qg = waitForQualityGate(installationName: "${installationName}")
                            } catch (Exception e) {
                                echo "Warning: waitForQualityGate failed with installation name. Trying default..."
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
        
        stage('Push to Docker Hub') {
            // This stage only runs if previous stages succeeded
            steps {
                echo 'Pushing Docker image to Docker Hub...'
                script {
                    sh """
                        docker login -u ${DOCKER_HUB_USERNAME} -p ${DOCKER_HUB_PASSWORD}
                        docker tag ${IMAGE_NAME}:${IMAGE_TAG} ${DOCKER_HUB_IMAGE}:${IMAGE_TAG}
                        docker tag ${IMAGE_NAME}:${IMAGE_TAG} ${DOCKER_HUB_IMAGE}:latest
                        docker push ${DOCKER_HUB_IMAGE}:${IMAGE_TAG}
                        docker push ${DOCKER_HUB_IMAGE}:latest
                    """
                }
            }
        }
        
        stage('Deploy Docker Container') {
            // This stage only runs if previous stages succeeded
            steps {
                echo 'Deploying Docker container from Docker Hub...'
                script {
                    sh """
                        # Stop and remove existing container if it exists
                        docker stop ${IMAGE_NAME} || true
                        docker rm ${IMAGE_NAME} || true
                        
                        # Pull the latest image from Docker Hub
                        docker pull ${DOCKER_HUB_IMAGE}:${IMAGE_TAG}
                        
                        # Run the new container
                        docker run -d \\
                            --name ${IMAGE_NAME} \\
                            -p 3000:3000 \\
                            --restart unless-stopped \\
                            ${DOCKER_HUB_IMAGE}:${IMAGE_TAG}
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
                ✓ Docker image built and pushed to Docker Hub
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
                    - Docker/Docker Hub stages were NOT executed
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
