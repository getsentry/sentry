#!/usr/bin/env bash
set -euo pipefail

# Only for disposable GitHub Actions jobs. A database/server crash requires a
# fresh job; these settings deliberately provide no crash recovery guarantees.
if [ "${GITHUB_ACTIONS:-}" != true ]; then
  echo '::error::Ephemeral databases are only supported in GitHub Actions'
  exit 1
fi

prepare() {
  local storage="${RUNNER_TEMP:?}/sentry-ci-databases"
  local project

  # devservices starts each remote dependency as its own Compose project.
  # Never replace an existing volume (for example on a reused runner).
  for project in postgres redis; do
    if docker volume inspect "${project}_${project}-data" >/dev/null 2>&1; then
      echo "::error::Expected a fresh CI volume: ${project}_${project}-data"
      exit 1
    fi
  done

  mkdir -p "$storage"
  # A host mount survives the backend job's postgres container recreation.
  # 8 GiB is a shared upper bound, not an up-front memory reservation.
  sudo mount -t tmpfs \
    -o "size=8g,uid=$(id -u),gid=$(id -g),mode=0700" tmpfs "$storage"
  for project in postgres redis; do
    mkdir -p "$storage/$project"
    docker volume create \
      --driver local \
      --opt type=none --opt o=bind --opt "device=$storage/$project" \
      --label "com.docker.compose.project=$project" \
      --label "com.docker.compose.volume=$project-data" \
      "${project}_${project}-data"
  done
}

verify_postgres() {
  local settings
  if [ "$(docker exec postgres-postgres-1 stat -f -c '%T' /var/lib/postgresql/data)" != tmpfs ]; then
    echo '::error::PostgreSQL data directory is not backed by tmpfs'
    exit 1
  fi
  # Reload is asynchronous. Check from fresh connections before testing starts.
  for _ in $(seq 1 40); do
    if settings=$(docker exec postgres-postgres-1 psql -XAt -U postgres -d sentry \
      -c "SELECT current_setting('fsync'), current_setting('synchronous_commit'), current_setting('full_page_writes')") && \
      [ "$settings" = 'off|off|off' ]; then
      echo 'PostgreSQL: fsync=off synchronous_commit=off full_page_writes=off'
      return
    fi
    sleep 0.25
  done
  echo "::error::Unexpected PostgreSQL durability settings: $settings"
  exit 1
}

configure_redis() {
  local container=$1 port=$2
  # Keep the server and its in-memory data alive while Snuba is bootstrapping.
  docker exec "$container" redis-cli -p "$port" CONFIG SET appendonly no
  docker exec "$container" redis-cli -p "$port" CONFIG SET save ''
  if [ "$(docker exec "$container" redis-cli --raw -p "$port" CONFIG GET appendonly)" != $'appendonly\nno' ] || \
    [ "$(docker exec "$container" redis-cli --raw -p "$port" CONFIG GET save)" != save ]; then
    echo "::error::Redis persistence is still enabled on $container:$port"
    exit 1
  fi
  echo "Redis $container:$port: appendonly=no save=''"
}

configure() {
  # Each ALTER SYSTEM must be a separate command, outside a transaction. The
  # resulting postgresql.auto.conf stays with PGDATA across the Unix-socket
  # container recreation. Keep the existing logical-WAL configuration.
  docker exec postgres-postgres-1 psql -X -v ON_ERROR_STOP=1 -U postgres -d sentry \
    -c 'ALTER SYSTEM SET fsync = off' \
    -c 'ALTER SYSTEM SET synchronous_commit = off' \
    -c 'ALTER SYSTEM SET full_page_writes = off' \
    -c 'SELECT pg_reload_conf()'
  verify_postgres
  if [ "$(docker exec redis-redis-1 stat -f -c '%T' /data)" != tmpfs ]; then
    echo '::error::Redis data directory is not backed by tmpfs'
    exit 1
  fi
  configure_redis redis-redis-1 6379
  if docker inspect sentry-redis-cluster-1 >/dev/null 2>&1; then
    for port in $(seq 7000 7005); do
      configure_redis sentry-redis-cluster-1 "$port"
    done
  fi
}

case "${1:-}" in
  prepare) prepare ;;
  configure) configure ;;
  verify-postgres) verify_postgres ;;
  *) echo "usage: $0 prepare|configure|verify-postgres" >&2; exit 1 ;;
esac
