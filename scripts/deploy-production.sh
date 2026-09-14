#!/bin/sh

set -u

PROJECT_NAME="helpdesk-production"
COMPOSE_FILE="compose.production.yaml"
APP_CONTAINER="helpdesk-production-app"
NGINX_CONTAINER="helpdesk-production-nginx"
DB_CONTAINER="helpdesk-production-db"
NETWORK_NAME="${PROJECT_NAME}_production-network"

PROD_DB_NAME="${PROD_DB_NAME:-helpdeskdb}"
PROD_DB_USER="${PROD_DB_USER:-helpdesk_prod}"
PROD_PORT="${PROD_PORT:-8084}"

require_env() {
    var_name="$1"
    eval "var_value=\${$var_name:-}"

    if [ -z "$var_value" ]; then
        echo "ERROR: environment variable $var_name is required"
        exit 1
    fi
}

require_env APP_IMAGE
require_env NGINX_IMAGE
require_env PROD_DB_PASSWORD

PREVIOUS_APP_IMAGE="$(
    docker inspect \
      --format='{{.Config.Image}}' \
      "$APP_CONTAINER" \
      2>/dev/null || true
)"

PREVIOUS_NGINX_IMAGE="$(
    docker inspect \
      --format='{{.Config.Image}}' \
      "$NGINX_CONTAINER" \
      2>/dev/null || true
)"

echo "========================================"
echo "PRODUCTION RELEASE"
echo "========================================"
echo "New APP   : $APP_IMAGE"
echo "New NGINX : $NGINX_IMAGE"

if [ -n "$PREVIOUS_APP_IMAGE" ]; then
    echo "Old APP   : $PREVIOUS_APP_IMAGE"
else
    echo "Old APP   : none (first deployment)"
fi

if [ -n "$PREVIOUS_NGINX_IMAGE" ]; then
    echo "Old NGINX : $PREVIOUS_NGINX_IMAGE"
else
    echo "Old NGINX : none (first deployment)"
fi

echo "========================================"

compose_up() {
    deploy_app_image="$1"
    deploy_nginx_image="$2"

    APP_IMAGE="$deploy_app_image" \
    NGINX_IMAGE="$deploy_nginx_image" \
    PROD_DB_NAME="$PROD_DB_NAME" \
    PROD_DB_USER="$PROD_DB_USER" \
    PROD_DB_PASSWORD="$PROD_DB_PASSWORD" \
    PROD_PORT="$PROD_PORT" \
    docker compose \
      -p "$PROJECT_NAME" \
      -f "$COMPOSE_FILE" \
      up -d
}

pull_release() {
    APP_IMAGE="$APP_IMAGE" \
    NGINX_IMAGE="$NGINX_IMAGE" \
    PROD_DB_NAME="$PROD_DB_NAME" \
    PROD_DB_USER="$PROD_DB_USER" \
    PROD_DB_PASSWORD="$PROD_DB_PASSWORD" \
    PROD_PORT="$PROD_PORT" \
    docker compose \
      -p "$PROJECT_NAME" \
      -f "$COMPOSE_FILE" \
      pull app nginx
}

health_check() {
    for i in $(seq 1 30)
    do
        echo "Production health check attempt $i"

        if docker run \
          --rm \
          --network "$NETWORK_NAME" \
          node:24-alpine \
          node -e "
            fetch('http://nginx/api/health')
              .then(async response => {
                const data = await response.json();
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
            return 0
        fi

        sleep 2
    done

    return 1
}

rollback() {
    echo "========================================"
    echo "ROLLBACK STARTED"
    echo "========================================"

    if [ -n "$PREVIOUS_APP_IMAGE" ] && \
       [ -n "$PREVIOUS_NGINX_IMAGE" ]
    then
        echo "Rollback APP   : $PREVIOUS_APP_IMAGE"
        echo "Rollback NGINX : $PREVIOUS_NGINX_IMAGE"

        if compose_up \
          "$PREVIOUS_APP_IMAGE" \
          "$PREVIOUS_NGINX_IMAGE"
        then
            echo "Previous release restored."

            if health_check
            then
                echo "ROLLBACK HEALTH CHECK PASSED"
            else
                echo "WARNING: rollback completed but health check failed"
            fi
        else
            echo "ERROR: rollback deployment failed"
        fi
    else
        echo "No previous production release exists."
        echo "Cleaning failed first deployment containers/network."

        APP_IMAGE="$APP_IMAGE" \
        NGINX_IMAGE="$NGINX_IMAGE" \
        PROD_DB_NAME="$PROD_DB_NAME" \
        PROD_DB_USER="$PROD_DB_USER" \
        PROD_DB_PASSWORD="$PROD_DB_PASSWORD" \
        PROD_PORT="$PROD_PORT" \
        docker compose \
          -p "$PROJECT_NAME" \
          -f "$COMPOSE_FILE" \
          down || true
    fi

    echo "========================================"
}

echo "=== PULL PRODUCTION IMAGES FROM GHCR ==="

if ! pull_release
then
    echo "ERROR: failed to pull production images"
    exit 1
fi

echo "=== DEPLOY PRODUCTION ==="

if ! compose_up "$APP_IMAGE" "$NGINX_IMAGE"
then
    echo "ERROR: production deployment failed"
    rollback
    exit 1
fi

RUNNING_APP_IMAGE="$(
    docker inspect \
      --format='{{.Config.Image}}' \
      "$APP_CONTAINER" \
      2>/dev/null || true
)"

RUNNING_NGINX_IMAGE="$(
    docker inspect \
      --format='{{.Config.Image}}' \
      "$NGINX_CONTAINER" \
      2>/dev/null || true
)"

echo "=== VERIFY PRODUCTION IMAGE ==="
echo "Expected APP   : $APP_IMAGE"
echo "Running APP    : $RUNNING_APP_IMAGE"
echo "Expected NGINX : $NGINX_IMAGE"
echo "Running NGINX  : $RUNNING_NGINX_IMAGE"

if [ "$RUNNING_APP_IMAGE" != "$APP_IMAGE" ] || \
   [ "$RUNNING_NGINX_IMAGE" != "$NGINX_IMAGE" ]
then
    echo "ERROR: production image verification failed"
    rollback
    exit 1
fi

echo "=== PRODUCTION HEALTH CHECK ==="

if ! health_check
then
    echo "ERROR: production health check failed"

    echo "=== APP LOG ==="
    docker logs "$APP_CONTAINER" || true

    echo "=== NGINX LOG ==="
    docker logs "$NGINX_CONTAINER" || true

    echo "=== DATABASE LOG ==="
    docker logs "$DB_CONTAINER" || true

    rollback
    exit 1
fi

echo "========================================"
echo "PRODUCTION DEPLOYMENT SUCCESS"
echo "========================================"
echo "APP   : $APP_IMAGE"
echo "NGINX : $NGINX_IMAGE"
echo "PORT  : $PROD_PORT"
echo "========================================"
