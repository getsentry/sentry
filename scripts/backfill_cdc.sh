#!/bin/bash
# Backfills all the CDC tables
set -e

declare -a STORAGES=("groupedmessages"  "groupassignees")

log_message() {
    GREEN='\033[0;32m'
    NC='\033[0m'

    echo -e "${GREEN}${1}${NC}"
}

mkdir -p /tmp/cdc-snapshots/

log_message "********* Taking the snapshot from Postgres *********"

cd "$(dirname "$0")"

docker run \
-v "$(pwd)"/../config/cdc/configuration.yaml:/etc/cdc/configuration.yaml \
-v "$(pwd)"/../config/cdc/cdc-snapshot-config.yaml:/etc/cdc/cdc-snapshot-config.yaml \
-v /tmp/cdc-snapshots:/tmp/cdc-snapshots \
--rm \
--network sentry \
ghcr.io/getsentry/cdc:latest \
cdc -c /etc/cdc/configuration.yaml \
snapshot --snapshot-config /etc/cdc/cdc-snapshot-config.yaml \
2>&1 | tee /tmp/cdc-snapshots/snapshot.log

SNAPSHOT_ID=$(awk '{ if($4=="Starting" && $5=="snapshot" && $6=="ID") print $7}' /tmp/cdc-snapshots/snapshot.log )
SNAPSHOT_PATH="/tmp/cdc-snapshots/cdc_snapshot_snuba_$SNAPSHOT_ID"
rm /tmp/cdc-snapshots/snapshot.log


log_message "********* Loading the snapshot into Snuba *********"

for i in "${!STORAGES[@]}";
do
    log_message "********* Loading ${STORAGES[$i]}"

    docker run \
    -v "$SNAPSHOT_PATH"/:/tmp/cdc-snapshot \
    --rm \
    --network sentry \
    -e SNUBA_SETTINGS=docker \
    -e CLICKHOUSE_HOST=sentry_clickhouse \
    getsentry/snuba:nightly \
    snuba bulk-load --storage="${STORAGES[$i]}" \
    --source=/tmp/cdc-snapshot \
    --ignore-existing-data \
    --pre-processed \
    --show-progress
done

log_message "********* Done *********"
echo "You can now remove the snapshot from $SNAPSHOT_PATH"
