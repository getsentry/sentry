#!/bin/bash
# Initializes the pg_hba file with access permissions to the replication
# slots.

set -e

{ echo "host replication all all trust"; } >> "$PGDATA/pg_hba.conf"
