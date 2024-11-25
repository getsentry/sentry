#!/bin/bash

POSTGRES_CONTAINER="sentry_postgres"
USE_NEW_DEVSERVICES=${USE_NEW_DEVSERVICES:-"0"}
if [ "$USE_NEW_DEVSERVICES" == "1" ]; then
    POSTGRES_CONTAINER="sentry-postgres-1"
fi

OLD_VERSION="9.6"
NEW_VERSION="14"
PG_IMAGE="ghcr.io/getsentry/image-mirror-library-postgres:${NEW_VERSION}-alpine"

PROJECT=${PROJECT:-sentry}
VOLUME_NAME="${PROJECT}_postgres"
TMP_VOLUME_NAME="${VOLUME_NAME}_${NEW_VERSION}"
TMP_CONTAINER="${PROJECT}_pg_migration"

echo "Stop the container"
docker stop "${POSTGRES_CONTAINER}"

echo "Check existence of a volume"
if [[ -z "$(docker volume ls -q --filter name="^${VOLUME_NAME}$")" ]]
then
    echo "PostgreSQL volume with name ${VOLUME_NAME} does not exist. Nothing to upgrade."
    exit 0
fi

echo "Get the current PostgreSQL version"
CURRENT_VERSION=$(docker run --rm -v ${VOLUME_NAME}:/db busybox cat /db/PG_VERSION 2>/dev/null)

echo "Current PostgreSQL version is ${CURRENT_VERSION}"

if [[ "${CURRENT_VERSION}" != "${OLD_VERSION}" ]]
then
    echo "Expected current PostgreSQL version is ${OLD_VERSION}."
    exit 1
fi


docker volume rm "${TMP_VOLUME_NAME}" || true

docker run --rm \
    -v ${VOLUME_NAME}:/var/lib/postgresql/${OLD_VERSION}/data \
    -v ${TMP_VOLUME_NAME}:/var/lib/postgresql/${NEW_VERSION}/data \
    tianon/postgres-upgrade:${OLD_VERSION}-to-${NEW_VERSION}

# Get rid of the old volume as we'll rename the new one to that
docker volume rm ${VOLUME_NAME}

docker volume create --name ${VOLUME_NAME}

# There's no rename volume in Docker so copy the contents from old to new name
# Also append the `host all all all trust`
docker run --rm -v ${TMP_VOLUME_NAME}:/from -v ${VOLUME_NAME}:/to alpine ash -c \
"cd /from ; cp -av . /to ; echo 'host all all all trust' >> /to/pg_hba.conf"

# Finally, remove the new old volume as we are all in sentry-postgres now
docker volume rm ${TMP_VOLUME_NAME}

echo "Due to glibc change re-indexing"
echo "Starting up new PostgreSQL version"
PG_VERSION=${NEW_VERSION} ${PROJECT} devservices up postgres

# Wait for postgres
RETRIES=5
until docker exec ${VOLUME_NAME} psql -U postgres -c "select 1" > /dev/null 2>&1 || [ $RETRIES -eq 0 ]; do
  echo "Waiting for postgres server, $((RETRIES--)) remaining attempts..."
  sleep 1
done

# VOLUME_NAME is the same as container name
# Reindex all databases and their system catalogs which are not templates
DBS=$(docker exec ${VOLUME_NAME} psql -qAt -U postgres -c "select datname from pg_database  where datistemplate = false;")
for db in ${DBS}
do
    echo "Re-indexing database: ${db}"
    docker exec ${VOLUME_NAME} psql -qAt -U postgres -d ${db} -c "reindex system ${db}"
    docker exec ${VOLUME_NAME} psql -qAt -U postgres -d ${db} -c "reindex database ${db};"
done

_PROFILE_LINE="export PG_VERSION=${NEW_VERSION}"

echo
echo "To configure your environment to use PostgreSQL with ${PROJECT}, PG_VERSION variable must be set."
echo "Save the following to your shell rc file:"
echo
echo "${_PROFILE_LINE}"
echo
