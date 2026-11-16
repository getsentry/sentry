#!/bin/sh
# Restart the devservices postgres container with its Unix socket on the host,
# and point tests at it with SENTRY_DB_SOCKET. Used by .github/workflows/backend.yml.
set -eu

container=postgres-postgres-1
sock_dir=/tmp/pg-sock
timeout_s=60

mkdir -p "$sock_dir"
image=$(docker inspect "$container" --format '{{.Config.Image}}')
docker stop "$container"
docker rm "$container"
docker run -d --name "$container" \
  --network devservices --label orchestrator=devservices \
  -p 127.0.0.1:5432:5432 \
  -v postgres-data:/var/lib/postgresql/data \
  -v "$sock_dir:/var/run/postgresql" \
  -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB=sentry \
  "$image" postgres \
  -c wal_level=logical -c max_replication_slots=1 -c max_wal_senders=1 \
  -c fsync=off -c synchronous_commit=off -c full_page_writes=off

# On an empty volume, the image's entrypoint runs initdb with a temporary server
# that listens only on the socket, then stops it and starts the real server. The
# socket alone can be the temporary server's and vanish a moment later, so also
# wait for TCP, which only the real server listens on. `docker run -d` returns 0
# even when postgres dies right away, so the wait is bounded.
waited=0
until [ -S "$sock_dir/.s.PGSQL.5432" ] &&
  docker exec "$container" pg_isready --quiet --host 127.0.0.1 --port 5432; do
  if [ "$waited" -ge "$timeout_s" ]; then
    echo "::error::postgres was not ready on its Unix socket after ${timeout_s}s"
    docker logs --tail 30 "$container" || true
    exit 1
  fi
  sleep 1
  waited=$((waited + 1))
done

echo "SENTRY_DB_SOCKET=$sock_dir" >>"$GITHUB_ENV"
