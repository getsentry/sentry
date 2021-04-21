#!/bin/bash
set -e

cdc_setup_hba_conf() {
    # Ensure pg-hba is properly configured
    PG_HBA="$PGDATA/pg_hba.conf"
    if [ ! -f "$PG_HBA" ]; then
        echo "DB not initialized. Postgres will take care of pg_hba"
    fi

    if grep -E "^host\s+replication" "$PGDATA"/pg_hba.conf
    then
        echo "Replication config already present in pg_hba"
    else
        echo "host replication all all $POSTGRES_HOST_AUTH_METHOD" >> "$PGDATA/pg_hba.conf"
    fi
}

echo "Setting up Change Data Capture"

if [ "$1" = 'postgres' ]; then
    cdc_setup_hba_conf
fi
exec /docker-entrypoint.sh "$@"
