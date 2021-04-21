#!/bin/bash
set -e

{ echo "host replication all all trust"; } >> "$PGDATA/pg_hba.conf"
