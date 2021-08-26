#!/bin/bash
# This script replaces the default docker entrypoint for postgres in the
# development environment.
# Its job is to ensure postgres is properly configured to support the
# Change Data Capture pipeline (by setting access permissions and installing
# the replication plugin we use for CDC). Unfortunately the default
# Postgres image does not allow this level of configurability so we need
# to do it this way in order not to have to publish and maintain our own
# Postgres image.
#
# This then, at the end, transfers control to the default entrypoint.

set -e

cdc_setup_hba_conf() {
    # Ensure pg-hba is properly configured to allow connections
    # to the replication slots.

    PG_HBA="$PGDATA/pg_hba.conf"
    if [ ! -f "$PG_HBA" ]; then
        echo "DB not initialized. Postgres will take care of pg_hba"
    elif [ "$(grep -c -E "^host\s+replication" "$PGDATA"/pg_hba.conf)" != 0 ]; then
        echo "Replication config already present in pg_hba. Not changing anything."
    else
        # Execute the same script we run on DB initialization
        /docker-entrypoint-initdb.d/init_hba.sh
    fi
}

install_wal2json() {
    # Install the latest version of wal2json if it is not already
    # present in /wal2json
    # If we cannot download the latest version from github the following
    # attempts are made:
    # - see if there is a valid version on the volume. Use that
    # - see if for any reason there is already a version in the postgres
    #   lib directory
    # If not it is a bad day. And this stops the process.

    set +e

    LATEST_VERSION_FILE="/wal2json/latest.so"
    ARCH=$(uname -m)
    FILE_NAME="wal2json-Linux-$ARCH-musl.so"
    LATEST_VERSION=$(
        wget "https://api.github.com/repos/getsentry/wal2json/releases/latest" -O - |
        grep '"tag_name":' |
        sed -E 's/.*"([^"]+)".*/\1/'
    )

    if [[ $LATEST_VERSION ]]; then
        if [ ! -f "/wal2json/$LATEST_VERSION/$FILE_NAME" ]; then
            mkdir -p "/wal2json/$LATEST_VERSION"
            if wget \
                "https://github.com/getsentry/wal2json/releases/download/$LATEST_VERSION/$FILE_NAME" \
                -P "/wal2json/$LATEST_VERSION/"; then
                ln -sf "/wal2json/$LATEST_VERSION/$FILE_NAME" "$LATEST_VERSION_FILE"
            fi
        fi
        ln -sf "$LATEST_VERSION_FILE" /usr/local/lib/postgresql/wal2json.so
    elif [ -f $LATEST_VERSION_FILE ]; then
        # We did not manage to detect the latest version or we failed at downloading.
        # Try to failover
        REAL_FILE=$(realpath $LATEST_VERSION_FILE)
        echo "Cannot download latest version. Found $REAL_FILE on disk"
        ln -sf "$LATEST_VERSION_FILE" /usr/local/lib/postgresql/wal2json.so
    elif [ -f "/usr/local/lib/postgresql/wal2json.so" ]; then
        # Somehow our volume is not in a good state but there is still a version
        # in the library directory. We take that one.
        echo "Cannot download latest version. Found a version on disk"
    else
        echo "wal2json is not installed and cannot download latest version"
        exit 1
    fi

    set -e
    echo "wal2json installed"
}

echo "Setting up Change Data Capture"

if [ "$1" = 'postgres' ]; then
    cdc_setup_hba_conf
    install_wal2json
fi
exec /docker-entrypoint.sh "$@"
