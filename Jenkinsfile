pipeline {
    agent any

    environment {
        IMAGE_NAME = 'helpdesk-app'
        IMAGE_TAG  = "ci-${BUILD_NUMBER}"
    }

    stages {

        stage('Checkout') {
            steps {
                echo 'Source code berhasil diambil dari GitHub'
                sh 'git log -1 --oneline'
            }
        }

        stage('Validate Source') {
            steps {
                echo 'Validasi file project'

                sh '''
                    test -f app/Dockerfile
                    test -f app/package.json
                    test -f app/server.js
                    test -f compose.yaml
                '''
            }
        }

        stage('Docker Check') {
            steps {
                echo 'Cek koneksi Jenkins ke Docker Engine'
                sh 'docker version'
            }
        }

        stage('Build Image') {
            steps {
                echo "Build ${IMAGE_NAME}:${IMAGE_TAG}"

                sh '''
                    docker build \
                    -t ${IMAGE_NAME}:${IMAGE_TAG} \
                    ./app
                '''
            }
        }

        stage('Verify Image') {
            steps {
                echo 'Verifikasi Docker image'

                sh '''
                    docker image inspect \
                    ${IMAGE_NAME}:${IMAGE_TAG}
                '''
            }
        }

        stage('Smoke Test') {
            steps {
                echo 'Test Node.js di dalam image'

                sh '''
                    docker run --rm \
                    ${IMAGE_NAME}:${IMAGE_TAG} \
                    node --version
                '''
            }
        }
    }

    post {

        success {
            echo 'CI PIPELINE SUCCESS'
        }

        failure {
            echo 'CI PIPELINE FAILED'
        }

        always {
            echo "Build Jenkins #${BUILD_NUMBER} selesai"
        }
    }
}