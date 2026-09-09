pipeline {

    agent any

    environment {

        APP_IMAGE = "helpdesk-app:ci-${BUILD_NUMBER}"
        DB_IMAGE = "helpdesk-db-test:ci-${BUILD_NUMBER}"
        NGINX_IMAGE = "helpdesk-nginx:ci-${BUILD_NUMBER}"

        CI_NETWORK = "helpdesk-ci-${BUILD_NUMBER}"

        APP_CONTAINER = "helpdesk-ci-app-${BUILD_NUMBER}"
        DB_CONTAINER = "helpdesk-ci-db-${BUILD_NUMBER}"
    }


    stages {


        // =========================================================
        // 1. CHECKOUT
        // =========================================================

        stage('Checkout') {

            steps {

                echo '=== CHECKOUT SOURCE ==='

                sh '''
                    git log -1 --oneline
                '''
            }
        }


        // =========================================================
        // 2. VALIDATE SOURCE
        // =========================================================

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

                    test -f nginx/Dockerfile
                    test -f nginx/nginx.conf
                    test -f nginx/html/index.html

                    test -f compose.staging.yaml

                    echo "SOURCE VALIDATION PASSED"
                '''
            }
        }


        // =========================================================
        // 3. DOCKER CHECK
        // =========================================================

        stage('Docker Check') {

            steps {

                echo '=== DOCKER CHECK ==='

                sh '''
                    docker version
                    docker compose version
                '''
            }
        }


        // =========================================================
        // 4. BUILD APPLICATION IMAGE
        // =========================================================

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


        // =========================================================
        // 5. UNIT TEST
        // =========================================================

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


        // =========================================================
        // 6. SYNTAX CHECK
        // =========================================================

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


        // =========================================================
        // 7. BUILD TEST DATABASE
        // =========================================================

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


        // =========================================================
        // 8. BUILD NGINX IMAGE
        // =========================================================

        stage('Build Nginx Image') {

            steps {

                echo '=== BUILD NGINX IMAGE ==='

                sh '''
                    docker build \
                      -t ${NGINX_IMAGE} \
                      ./nginx
                '''
            }
        }


        // =========================================================
        // 9. CREATE CI TEST NETWORK
        // =========================================================

        stage('Create Test Network') {

            steps {

                echo '=== CREATE CI NETWORK ==='

                sh '''
                    docker network create ${CI_NETWORK}
                '''
            }
        }


        // =========================================================
        // 10. START POSTGRESQL TEST CONTAINER
        // =========================================================

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


                echo '=== WAIT POSTGRESQL ==='

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
                            echo "POSTGRESQL READY"
                            exit 0
                        fi

                        sleep 2
                    done


                    echo "POSTGRESQL FAILED"

                    docker logs ${DB_CONTAINER} || true

                    exit 1
                '''
            }
        }


        // =========================================================
        // 11. START APPLICATION TEST CONTAINER
        // =========================================================

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


        // =========================================================
        // 12. CI INTEGRATION HEALTH CHECK
        // =========================================================

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

                                process.exit(0);
                            })
                            .catch(error => {

                                console.error(error);

                                process.exit(1);
                            });
                          "
                        then

                            echo "================================"
                            echo "INTEGRATION TEST PASSED"
                            echo "================================"

                            exit 0
                        fi

                        sleep 2
                    done


                    echo "================================"
                    echo "APPLICATION HEALTH CHECK FAILED"
                    echo "================================"

                    docker logs ${APP_CONTAINER} || true

                    exit 1
                '''
            }
        }


        // =========================================================
        // 13. VERIFY APPLICATION IMAGE
        // =========================================================

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


        // =========================================================
        // 14. DEPLOY TO STAGING
        // =========================================================

        stage('Deploy Staging') {

            steps {

                echo '=== DEPLOY TO STAGING ==='

                sh '''
                    APP_IMAGE=${APP_IMAGE} \
                    DB_IMAGE=${DB_IMAGE} \
                    NGINX_IMAGE=${NGINX_IMAGE} \
                    docker compose \
                      -p helpdesk-staging \
                      -f compose.staging.yaml \
                      up -d
                '''


                echo '=== STAGING CONTAINERS ==='

                sh '''
                    APP_IMAGE=${APP_IMAGE} \
                    DB_IMAGE=${DB_IMAGE} \
                    NGINX_IMAGE=${NGINX_IMAGE} \
                    docker compose \
                      -p helpdesk-staging \
                      -f compose.staging.yaml \
                      ps
                '''
            }
        }


        // =========================================================
        // 15. STAGING HEALTH CHECK
        // =========================================================

        stage('Staging Health Check') {

            steps {

                echo '=== STAGING HEALTH CHECK ==='

                sh '''
                    for i in $(seq 1 30)
                    do

                        echo "Staging health check attempt ${i}"

                        if docker run \
                          --rm \
                          --network helpdesk-staging_staging-network \
                          node:24-alpine \
                          node -e "
                            fetch(
                              'http://nginx/api/health'
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

                                process.exit(0);
                            })
                            .catch(error => {

                                console.error(error);

                                process.exit(1);
                            });
                          "
                        then

                            echo "================================"
                            echo "STAGING HEALTHY"
                            echo "================================"

                            exit 0
                        fi

                        sleep 2
                    done


                    echo "================================"
                    echo "STAGING HEALTH CHECK FAILED"
                    echo "================================"

                    echo "=== APP LOG ==="
                    docker logs helpdesk-staging-app || true

                    echo "=== NGINX LOG ==="
                    docker logs helpdesk-staging-nginx || true

                    echo "=== DATABASE LOG ==="
                    docker logs helpdesk-staging-db || true

                    exit 1
                '''
            }
        }

    }


    // =============================================================
    // POST ACTION
    // =============================================================

    post {


        // ---------------------------------------------------------
        // CLEANUP HANYA CONTAINER CI TEST
        // STAGING TIDAK DIHAPUS
        // ---------------------------------------------------------

        always {

            echo '=== CI CLEANUP ==='

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


        // ---------------------------------------------------------
        // SUCCESS
        // ---------------------------------------------------------

        success {

            echo '''
========================================
       CI/CD PIPELINE SUCCESS
========================================
Unit Test        : PASS
Syntax Check     : PASS
Docker Build     : PASS
PostgreSQL Test  : PASS
Integration Test : PASS
Nginx Build      : PASS
Staging Deploy   : PASS
Staging Health   : PASS
========================================
'''
        }


        // ---------------------------------------------------------
        // FAILURE
        // ---------------------------------------------------------

        failure {

            echo '''
========================================
        CI/CD PIPELINE FAILED
========================================
Lihat stage yang berwarna merah
pada Jenkins Pipeline.
========================================
'''
        }

    }

}