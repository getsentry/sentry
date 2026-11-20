#!/bin/sh
# Restarts devservices' postgres container with its Unix socket in
# /tmp/pg-sock, and sets SENTRY_DB_SOCKET so the tests connect through it.
set -eu

: "${GITHUB_ENV:?}"

mkdir -p /tmp/pg-sock
PG_IMAGE=$(docker inspect postgres-postgres-1 --format '{{.Config.Image}}')
docker stop postgres-postgres-1 && docker rm postgres-postgres-1
docker run -d --name postgres-postgres-1 \
  --network devservices --label orchestrator=devservices \
  -p 127.0.0.1:5432:5432 \
  -v postgres-data:/var/lib/postgresql/data \
  -v /tmp/pg-sock:/var/run/postgresql \
  -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB=sentry \
  "$PG_IMAGE" postgres \
  -c wal_level=logical -c max_replication_slots=1 -c max_wal_senders=1 \
  -c fsync=off -c synchronous_commit=off -c full_page_writes=off
# On an empty volume, the image's entrypoint runs initdb with a temporary
# server that listens only on the socket, then stops it and starts the
# real one. The socket alone can vanish a moment after it appears, so also
# wait for TCP, which only the real server listens on. docker run -d
# returns 0 even if postgres dies right after, so the wait is bounded.
for _ in $(seq 1 60); do
  if [ -S "/tmp/pg-sock/.s.PGSQL.5432" ] &&
    docker exec postgres-postgres-1 pg_isready --quiet --host 127.0.0.1 --port 5432; then
    echo "SENTRY_DB_SOCKET=/tmp/pg-sock" >>"$GITHUB_ENV"
    exit 0
  fi
  sleep 1
done
echo "::error::postgres was not ready on its Unix socket after 60s"
docker logs postgres-postgres-1 2>&1 | tail -30 || true
exit 1
