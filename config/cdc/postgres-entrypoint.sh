#!/bin/bash
set -e

WAL2JSON_VERSION=0.0.1

cdc_setup_hba_conf() {
    # Ensure pg-hba is properly configured

    PG_HBA="$PGDATA/pg_hba.conf"
    if [ ! -f "$PG_HBA" ]; then
        echo "DB not initialized. Postgres will take care of pg_hba"
    fi

    if [ "$(grep -c -E "^host\s+replication" "$PGDATA"/pg_hba.conf)" -ge 0 ]; then
        echo "Replication config already present in pg_hba"
    else
        echo "host replication all all $POSTGRES_HOST_AUTH_METHOD" >> "$PGDATA/pg_hba.conf"
    fi
}

install_wal2json() {
    # Install the pinned version of wal2json if it is not already
    # present in /wal2json

    ARCH=$(uname -m)
    FILE_NAME="wal2json-Linux-$ARCH.so"

    if [ ! -f "/wal2json/$WAL2JSON_VERSION/$FILE_NAME" ]; then
        mkdir -p "/wal2json/$WAL2JSON_VERSION"
        wget \
            "https://github.com/getsentry/wal2json/releases/download/$WAL2JSON_VERSION/$FILE_NAME" \
            -P "/wal2json/$WAL2JSON_VERSION/"
    fi

    cp "/wal2json/$WAL2JSON_VERSION/$FILE_NAME" /usr/local/lib/postgresql/wal2json.so

    echo "wal2json installed"
}

echo "Setting up Change Data Capture"

if [ "$1" = 'postgres' ]; then
    cdc_setup_hba_conf
    install_wal2json
fi
exec /docker-entrypoint.sh "$@"
