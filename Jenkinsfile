pipeline {

    agent any

    environment {
        APP_IMAGE = "helpdesk-app:ci-${BUILD_NUMBER}"
        DB_IMAGE = "helpdesk-db-test:ci-${BUILD_NUMBER}"

        CI_NETWORK = "helpdesk-ci-${BUILD_NUMBER}"

        APP_CONTAINER = "helpdesk-ci-app-${BUILD_NUMBER}"
        DB_CONTAINER = "helpdesk-ci-db-${BUILD_NUMBER}"
    }

    stages {

        stage('Checkout') {
            steps {
                echo '=== CHECKOUT SOURCE ==='

                sh '''
                    git log -1 --oneline
                '''
            }
        }

        stage('Validate Source') {
            steps {
                echo '=== VALIDATE SOURCE ==='

                sh '''
                    test -f app/Dockerfile
                    test -f app/package.json
                    test -f app/package-lock.json
                    test -f app/server.js
                    test -f app/validation.js
                    test -f app/test/validation.test.js

                    test -f db/Dockerfile
                    test -f db/init.sql
                '''
            }
        }

        stage('Docker Check') {
            steps {
                echo '=== DOCKER CHECK ==='

                sh '''
                    docker version
                '''
            }
        }

        stage('Build App Image') {
            steps {
                echo '=== BUILD APP IMAGE ==='

                sh '''
                    docker build \
                    -t ${APP_IMAGE} \
                    ./app
                '''
            }
        }

        stage('Unit Test') {
            steps {
                echo '=== UNIT TEST ==='

                sh '''
                    docker run \
                    --rm \
                    ${APP_IMAGE} \
                    npm test
                '''
            }
        }

        stage('Syntax Check') {
            steps {
                echo '=== SYNTAX CHECK ==='

                sh '''
                    docker run \
                    --rm \
                    ${APP_IMAGE} \
                    npm run check
                '''
            }
        }

        stage('Build Test Database') {
            steps {
                echo '=== BUILD TEST DATABASE ==='

                sh '''
                    docker build \
                    -t ${DB_IMAGE} \
                    ./db
                '''
            }
        }

        stage('Create Test Network') {
            steps {
                echo '=== CREATE CI NETWORK ==='

                sh '''
                    docker network create ${CI_NETWORK}
                '''
            }
        }

        stage('Start PostgreSQL') {
            steps {
                echo '=== START POSTGRESQL ==='

                sh '''
                    docker run -d \
                    --name ${DB_CONTAINER} \
                    --network ${CI_NETWORK} \
                    -e POSTGRES_DB=helpdeskdb \
                    -e POSTGRES_USER=helpdesk \
                    -e POSTGRES_PASSWORD=helpdesk123 \
                    --health-cmd="pg_isready -U helpdesk -d helpdeskdb" \
                    --health-interval=2s \
                    --health-timeout=2s \
                    --health-retries=30 \
                    ${DB_IMAGE}
                '''

                sh '''
                    for i in $(seq 1 30)
                    do

                        STATUS=$(docker inspect \
                          --format='{{.State.Health.Status}}' \
                          ${DB_CONTAINER} \
                          2>/dev/null || true)

                        echo "Database status: ${STATUS}"

                        if [ "${STATUS}" = "healthy" ]
                        then
                            echo "PostgreSQL READY"
                            exit 0
                        fi

                        sleep 2
                    done

                    echo "PostgreSQL FAILED"

                    docker logs ${DB_CONTAINER}

                    exit 1
                '''
            }
        }

        stage('Start Application') {
            steps {
                echo '=== START APPLICATION ==='

                sh '''
                    docker run -d \
                    --name ${APP_CONTAINER} \
                    --network ${CI_NETWORK} \
                    -e DB_HOST=${DB_CONTAINER} \
                    -e DB_PORT=5432 \
                    -e DB_NAME=helpdeskdb \
                    -e DB_USER=helpdesk \
                    -e DB_PASSWORD=helpdesk123 \
                    -e PORT=3000 \
                    ${APP_IMAGE}
                '''
            }
        }

        stage('Integration Health Check') {
            steps {
                echo '=== INTEGRATION HEALTH CHECK ==='

                sh '''
                    for i in $(seq 1 30)
                    do

                        echo "Health check attempt ${i}"

                        if docker run \
                          --rm \
                          --network ${CI_NETWORK} \
                          node:24-alpine \
                          node -e "
                            fetch(
                              'http://${APP_CONTAINER}:3000/health'
                            )
                            .then(async response => {

                              const data =
                                await response.json();

                              console.log(data);

                              if (
                                !response.ok ||
                                data.status !== 'healthy' ||
                                data.database !== 'connected'
                              ) {
                                process.exit(1);
                              }

                            })
                            .catch(error => {
                              console.error(error);
                              process.exit(1);
                            });
                          "
                        then

                            echo "INTEGRATION TEST PASSED"
                            exit 0
                        fi

                        sleep 2
                    done

                    echo "APPLICATION HEALTH CHECK FAILED"

                    docker logs ${APP_CONTAINER}

                    exit 1
                '''
            }
        }

        stage('Verify Image') {
            steps {
                echo '=== VERIFY IMAGE ==='

                sh '''
                    docker image inspect \
                    --format='{{.Id}}' \
                    ${APP_IMAGE}
                '''
            }
        }
    }

    post {

        always {

            echo '=== CLEANUP ==='

            sh '''
                docker rm -f \
                  ${APP_CONTAINER} \
                  >/dev/null 2>&1 || true

                docker rm -f \
                  ${DB_CONTAINER} \
                  >/dev/null 2>&1 || true

                docker network rm \
                  ${CI_NETWORK} \
                  >/dev/null 2>&1 || true
            '''

            echo "Build Jenkins #${BUILD_NUMBER} selesai"
        }

        success {
            echo '''
================================
CI PIPELINE SUCCESS
================================
Unit Test        : PASS
Syntax Check     : PASS
Docker Build     : PASS
PostgreSQL Test  : PASS
Integration Test : PASS
================================
'''
        }

        failure {
            echo '''
================================
CI PIPELINE FAILED
================================
Lihat stage yang gagal.
================================
'''
        }
    }
}