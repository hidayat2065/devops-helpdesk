pipeline {

    agent any

    environment {

        // =========================================================
        // LOCAL CI IMAGES
        // =========================================================
        APP_IMAGE = "helpdesk-app:ci-${BUILD_NUMBER}"
        DB_IMAGE = "helpdesk-db-test:ci-${BUILD_NUMBER}"
        NGINX_IMAGE = "helpdesk-nginx:ci-${BUILD_NUMBER}"

        // =========================================================
        // GITHUB CONTAINER REGISTRY
        // =========================================================
        GHCR_REGISTRY = "ghcr.io"
        GHCR_OWNER = "hidayat2065"

        // =========================================================
        // CI TEST ENVIRONMENT
        // =========================================================
        CI_NETWORK = "helpdesk-ci-${BUILD_NUMBER}"

        APP_CONTAINER = "helpdesk-ci-app-${BUILD_NUMBER}"
        DB_CONTAINER = "helpdesk-ci-db-${BUILD_NUMBER}"

        // =========================================================
        // PRODUCTION
        // =========================================================
        PROD_DB_NAME = "helpdeskdb"
        PROD_DB_USER = "helpdesk_prod"
        PROD_PORT = "8084"
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
        // 2. GENERATE VERSION
        // =========================================================
        stage('Generate Version') {
            steps {
                script {

                    env.GIT_SHORT_SHA = sh(
                        script: 'git rev-parse --short HEAD',
                        returnStdout: true
                    ).trim()

                    env.GHCR_APP_IMAGE =
                        "${GHCR_REGISTRY}/${GHCR_OWNER}/devops-helpdesk-app:${env.GIT_SHORT_SHA}"

                    env.GHCR_NGINX_IMAGE =
                        "${GHCR_REGISTRY}/${GHCR_OWNER}/devops-helpdesk-nginx:${env.GIT_SHORT_SHA}"

                    echo '========================================'
                    echo 'BUILD VERSION'
                    echo '========================================'
                    echo "Jenkins Build : ${BUILD_NUMBER}"
                    echo "Git Commit    : ${env.GIT_SHORT_SHA}"
                    echo "App Image     : ${env.GHCR_APP_IMAGE}"
                    echo "Nginx Image   : ${env.GHCR_NGINX_IMAGE}"
                    echo '========================================'
                }
            }
        }

        // =========================================================
        // 3. VALIDATE SOURCE
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
                    test -f compose.production.yaml
                    test -f scripts/deploy-production.sh

                    echo "SOURCE VALIDATION PASSED"
                '''
            }
        }

        // =========================================================
        // 4. DOCKER CHECK
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
        // 5. BUILD APPLICATION
        // =========================================================
        stage('Build App Image') {
            steps {
                echo '=== BUILD APP IMAGE ==='

                sh '''
                    docker build                       -t ${APP_IMAGE}                       ./app
                '''
            }
        }

        // =========================================================
        // 6. UNIT TEST
        // =========================================================
        stage('Unit Test') {
            steps {
                echo '=== UNIT TEST ==='

                sh '''
                    docker run                       --rm                       ${APP_IMAGE}                       npm test
                '''
            }
        }

        // =========================================================
        // 7. SYNTAX CHECK
        // =========================================================
        stage('Syntax Check') {
            steps {
                echo '=== SYNTAX CHECK ==='

                sh '''
                    docker run                       --rm                       ${APP_IMAGE}                       npm run check
                '''
            }
        }

        // =========================================================
        // 8. BUILD TEST DATABASE
        // =========================================================
        stage('Build Test Database') {
            steps {
                echo '=== BUILD TEST DATABASE ==='

                sh '''
                    docker build                       -t ${DB_IMAGE}                       ./db
                '''
            }
        }

        // =========================================================
        // 9. BUILD NGINX
        // =========================================================
        stage('Build Nginx Image') {
            steps {
                echo '=== BUILD NGINX IMAGE ==='

                sh '''
                    docker build                       -t ${NGINX_IMAGE}                       ./nginx
                '''
            }
        }

        // =========================================================
        // 10. PREPARE CI TEST ENVIRONMENT
        // =========================================================
        stage('Create Test Network') {
            steps {
                echo '=== CREATE CI TEST NETWORK ==='

                sh '''
                    docker rm -f                       ${APP_CONTAINER}                       >/dev/null 2>&1 || true

                    docker rm -f                       ${DB_CONTAINER}                       >/dev/null 2>&1 || true

                    docker network rm                       ${CI_NETWORK}                       >/dev/null 2>&1 || true

                    docker network create                       ${CI_NETWORK}
                '''
            }
        }

        // =========================================================
        // 11. START POSTGRESQL
        // =========================================================
        stage('Start PostgreSQL') {
            steps {
                echo '=== START POSTGRESQL TEST DATABASE ==='

                sh '''
                    docker run -d                       --name ${DB_CONTAINER}                       --network ${CI_NETWORK}                       -e POSTGRES_DB=helpdeskdb                       -e POSTGRES_USER=helpdesk                       -e POSTGRES_PASSWORD=helpdesk123                       --health-cmd="pg_isready -U helpdesk -d helpdeskdb"                       --health-interval=2s                       --health-timeout=2s                       --health-retries=30                       ${DB_IMAGE}
                '''

                echo '=== WAIT POSTGRESQL ==='

                sh '''
                    for i in $(seq 1 30)
                    do
                        STATUS=$(docker inspect                           --format='{{.State.Health.Status}}'                           ${DB_CONTAINER}                           2>/dev/null || true)

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
        // 12. START APPLICATION
        // =========================================================
        stage('Start Application') {
            steps {
                echo '=== START TEST APPLICATION ==='

                sh '''
                    docker run -d                       --name ${APP_CONTAINER}                       --network ${CI_NETWORK}                       -e DB_HOST=${DB_CONTAINER}                       -e DB_PORT=5432                       -e DB_NAME=helpdeskdb                       -e DB_USER=helpdesk                       -e DB_PASSWORD=helpdesk123                       -e PORT=3000                       ${APP_IMAGE}
                '''
            }
        }

        // =========================================================
        // 13. INTEGRATION TEST
        // =========================================================
        stage('Integration Health Check') {
            steps {
                echo '=== INTEGRATION HEALTH CHECK ==='

                sh '''
                    for i in $(seq 1 30)
                    do
                        echo "Health check attempt ${i}"

                        if docker run                           --rm                           --network ${CI_NETWORK}                           node:24-alpine                           node -e "
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
                            echo '========================================'
                            echo 'INTEGRATION TEST PASSED'
                            echo '========================================'
                            exit 0
                        fi

                        sleep 2
                    done

                    echo '========================================'
                    echo 'INTEGRATION TEST FAILED'
                    echo '========================================'

                    echo '=== APPLICATION LOG ==='
                    docker logs ${APP_CONTAINER} || true

                    exit 1
                '''
            }
        }

        // =========================================================
        // 14. VERIFY IMAGE
        // =========================================================
        stage('Verify Image') {
            steps {
                echo '=== VERIFY APPLICATION IMAGE ==='

                sh '''
                    docker image inspect                       --format='{{.Id}}'                       ${APP_IMAGE}
                '''
            }
        }

        // =========================================================
        // 15. LOGIN GHCR
        // =========================================================
        stage('Login GHCR') {
            steps {
                echo '=== LOGIN GITHUB CONTAINER REGISTRY ==='

                withCredentials([
                    string(
                        credentialsId: 'ghcr-token1',
                        variable: 'GHCR_TOKEN'
                    )
                ]) {
                    sh '''
                        echo "$GHCR_TOKEN" |                         docker login                           ${GHCR_REGISTRY}                           -u ${GHCR_OWNER}                           --password-stdin
                    '''
                }
            }
        }

        // =========================================================
        // 16. TAG IMAGES
        // =========================================================
        stage('Tag Images') {
            steps {
                echo '=== TAG IMAGES FOR GHCR ==='

                sh '''
                    docker tag                       ${APP_IMAGE}                       ${GHCR_APP_IMAGE}

                    docker tag                       ${NGINX_IMAGE}                       ${GHCR_NGINX_IMAGE}

                    echo "APP IMAGE:"
                    echo "${GHCR_APP_IMAGE}"

                    echo "NGINX IMAGE:"
                    echo "${GHCR_NGINX_IMAGE}"
                '''
            }
        }

        // =========================================================
        // 17. PUSH IMAGES TO GHCR
        // =========================================================
        stage('Push Images') {
            steps {
                echo '=== PUSH IMAGES TO GHCR ==='

                sh '''
                    docker push                       ${GHCR_APP_IMAGE}

                    docker push                       ${GHCR_NGINX_IMAGE}
                '''
            }
        }

        // =========================================================
        // 18. PULL STAGING IMAGES FROM GHCR
        // =========================================================
        stage('Pull Staging Images') {
            steps {
                echo '=== PULL STAGING IMAGES FROM GHCR ==='

                sh '''
                    APP_IMAGE=${GHCR_APP_IMAGE}                     DB_IMAGE=${DB_IMAGE}                     NGINX_IMAGE=${GHCR_NGINX_IMAGE}                     docker compose                       -p helpdesk-staging                       -f compose.staging.yaml                       pull app nginx
                '''
            }
        }

        // =========================================================
        // 19. DEPLOY STAGING FROM GHCR
        // =========================================================
        stage('Deploy Staging') {
            steps {
                echo '=== DEPLOY STAGING FROM GHCR ==='

                sh '''
                    APP_IMAGE=${GHCR_APP_IMAGE}                     DB_IMAGE=${DB_IMAGE}                     NGINX_IMAGE=${GHCR_NGINX_IMAGE}                     docker compose                       -p helpdesk-staging                       -f compose.staging.yaml                       up -d
                '''

                echo '=== STAGING CONTAINERS ==='

                sh '''
                    APP_IMAGE=${GHCR_APP_IMAGE}                     DB_IMAGE=${DB_IMAGE}                     NGINX_IMAGE=${GHCR_NGINX_IMAGE}                     docker compose                       -p helpdesk-staging                       -f compose.staging.yaml                       ps
                '''
            }
        }

        // =========================================================
        // 20. VERIFY STAGING IMAGES
        // =========================================================
        stage('Verify Staging Images') {
            steps {
                echo '=== VERIFY STAGING IMAGE VERSION ==='

                sh '''
                    RUNNING_APP_IMAGE=$(docker inspect                       --format='{{.Config.Image}}'                       helpdesk-staging-app)

                    RUNNING_NGINX_IMAGE=$(docker inspect                       --format='{{.Config.Image}}'                       helpdesk-staging-nginx)

                    echo "Expected APP:"
                    echo "${GHCR_APP_IMAGE}"

                    echo "Running APP:"
                    echo "${RUNNING_APP_IMAGE}"

                    echo ""

                    echo "Expected NGINX:"
                    echo "${GHCR_NGINX_IMAGE}"

                    echo "Running NGINX:"
                    echo "${RUNNING_NGINX_IMAGE}"

                    if [ "${RUNNING_APP_IMAGE}" != "${GHCR_APP_IMAGE}" ]
                    then
                        echo "ERROR: APP IMAGE VERSION MISMATCH"
                        exit 1
                    fi

                    if [ "${RUNNING_NGINX_IMAGE}" != "${GHCR_NGINX_IMAGE}" ]
                    then
                        echo "ERROR: NGINX IMAGE VERSION MISMATCH"
                        exit 1
                    fi

                    echo "========================================"
                    echo "STAGING IMAGE VERIFICATION PASSED"
                    echo "========================================"
                '''
            }
        }

        // =========================================================
        // 21. STAGING HEALTH CHECK
        // =========================================================
        stage('Staging Health Check') {
            steps {
                echo '=== STAGING HEALTH CHECK ==='

                sh '''
                    for i in $(seq 1 30)
                    do
                        echo "Staging health check attempt ${i}"

                        if docker run                           --rm                           --network helpdesk-staging_staging-network                           node:24-alpine                           node -e "
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
                            echo '========================================'
                            echo 'STAGING HEALTHY'
                            echo '========================================'
                            exit 0
                        fi

                        sleep 2
                    done

                    echo '========================================'
                    echo 'STAGING HEALTH CHECK FAILED'
                    echo '========================================'

                    echo '=== APP LOG ==='
                    docker logs helpdesk-staging-app || true

                    echo '=== NGINX LOG ==='
                    docker logs helpdesk-staging-nginx || true

                    echo '=== DATABASE LOG ==='
                    docker logs helpdesk-staging-db || true

                    exit 1
                '''
            }
        }


        // =========================================================
        // 22. MANUAL PRODUCTION APPROVAL
        // =========================================================
        stage('Production Approval') {
            steps {
                timeout(time: 30, unit: 'MINUTES') {
                    input(
                        message:
                            "Staging sehat. Deploy commit ${GIT_SHORT_SHA} ke PRODUCTION?",
                        ok: 'Deploy ke Production'
                    )
                }
            }
        }

        // =========================================================
        // 23. PRODUCTION DEPLOY + AUTOMATIC ROLLBACK
        // =========================================================
        stage('Deploy Production') {
            steps {
                echo '=== DEPLOY PRODUCTION ==='
                echo "Release : ${GIT_SHORT_SHA}"
                echo "Port    : ${PROD_PORT}"

                withCredentials([
                    string(
                        credentialsId: 'prod-db-pass',
                        variable: 'PROD_DB_PASSWORD'
                    )
                ]) {
                    sh '''
                        chmod +x scripts/deploy-production.sh

                        APP_IMAGE=${GHCR_APP_IMAGE} \
                        NGINX_IMAGE=${GHCR_NGINX_IMAGE} \
                        PROD_DB_NAME=${PROD_DB_NAME} \
                        PROD_DB_USER=${PROD_DB_USER} \
                        PROD_DB_PASSWORD="$PROD_DB_PASSWORD" \
                        PROD_PORT=${PROD_PORT} \
                        ./scripts/deploy-production.sh
                    '''
                }
            }
        }

        // =========================================================
        // 24. VERIFY PRODUCTION
        // =========================================================
        stage('Verify Production') {
            steps {
                echo '=== VERIFY PRODUCTION CONTAINERS ==='

                sh '''
                    RUNNING_APP_IMAGE=$(docker inspect \
                      --format='{{.Config.Image}}' \
                      helpdesk-production-app)

                    RUNNING_NGINX_IMAGE=$(docker inspect \
                      --format='{{.Config.Image}}' \
                      helpdesk-production-nginx)

                    DB_STATUS=$(docker inspect \
                      --format='{{.State.Health.Status}}' \
                      helpdesk-production-db)

                    echo "APP      : ${RUNNING_APP_IMAGE}"
                    echo "NGINX    : ${RUNNING_NGINX_IMAGE}"
                    echo "DATABASE : ${DB_STATUS}"

                    if [ "${RUNNING_APP_IMAGE}" != "${GHCR_APP_IMAGE}" ]
                    then
                        echo "ERROR: production APP image mismatch"
                        exit 1
                    fi

                    if [ "${RUNNING_NGINX_IMAGE}" != "${GHCR_NGINX_IMAGE}" ]
                    then
                        echo "ERROR: production NGINX image mismatch"
                        exit 1
                    fi

                    if [ "${DB_STATUS}" != "healthy" ]
                    then
                        echo "ERROR: production database is not healthy"
                        exit 1
                    fi

                    echo "========================================"
                    echo "PRODUCTION VERIFICATION PASSED"
                    echo "========================================"
                '''
            }
        }

    }

    // =============================================================
    // POST ACTIONS
    // =============================================================
    post {

        always {

            echo '=== CI CLEANUP ==='

            sh '''
                docker rm -f                   ${APP_CONTAINER}                   >/dev/null 2>&1 || true

                docker rm -f                   ${DB_CONTAINER}                   >/dev/null 2>&1 || true

                docker network rm                   ${CI_NETWORK}                   >/dev/null 2>&1 || true

                docker logout                   ${GHCR_REGISTRY}                   >/dev/null 2>&1 || true
            '''

            echo "Build Jenkins #${BUILD_NUMBER} selesai"
        }

        success {

            echo '''
================================================
             CI/CD PIPELINE SUCCESS
================================================
Source Validation       : PASS
Unit Test               : PASS
Syntax Check            : PASS
Docker Build            : PASS
PostgreSQL Test         : PASS
Integration Test        : PASS
Nginx Build             : PASS
GHCR Login              : PASS
GHCR Push               : PASS
GHCR Staging Pull       : PASS
Staging Deploy          : PASS
Staging Image Verify    : PASS
Staging Health          : PASS
Production Approval     : APPROVED
Production Deploy       : PASS
Production Verify       : PASS
================================================
'''
        }

        aborted {

            echo '''
================================================
             PIPELINE ABORTED
================================================
Production tidak dideploy karena approval
dibatalkan atau timeout.
Staging tetap berjalan.
================================================
'''
        }

        failure {

            echo '''
================================================
             CI/CD PIPELINE FAILED
================================================

Lihat stage Jenkins yang berwarna merah.

Jika gagal pada:

Login GHCR
-> cek credential ID ghcr-token

Push Images
-> cek permission write:packages

Pull Staging Images
-> cek package GHCR dan login registry

Integration Health Check
-> cek app/database log

Deploy Staging
-> cek compose.staging.yaml

Verify Staging Images
-> cek image yang sedang dipakai container staging

Staging Health Check
-> cek Nginx/App/PostgreSQL

================================================
'''
        }

    }

}
