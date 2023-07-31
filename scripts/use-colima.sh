#!/bin/bash

echo "Copying your postgres and clickhouse volume for use with colima. Will take a few minutes."
tmpdir=$(mktemp -d)
mkdir "${tmpdir}/postgres" "${tmpdir}/clickhouse"
docker context use desktop-linux
docker run --rm -v sentry_postgres:/from -v "${tmpdir}/postgres:/to" alpine ash -c "cd /from ; cp -a . /to" || { echo "You need to start Docker Desktop."; exit 1; }
docker run --rm -v sentry_clickhouse:/from -v "${tmpdir}/clickhouse:/to" alpine ash -c "cd /from ; cp -a . /to"

echo "Stopping Docker.app. If a 'process terminated unexpectedly' dialog appears, dismiss it."
osascript - <<'EOF' || exit
quit application "Docker"
EOF

# We aren't uninstalling for now - this makes rolling back to docker desktop faster.
# Also, less breakage as people may be using things like docker-credential-desktop.
# echo "Uninstalling docker cask (which includes Docker Desktop)."
# brew uninstall --cask docker

# We do want to get people on just the docker cli though, to enable uninstalling the cask.
echo "Installing docker (cli only)."
brew install docker
# Unlinks docker (cask).
brew unlink docker
brew link --overwrite docker

# This removes credsStore, saving it under oldCredsStore so it can be restored later.
# The right value under colima for this is "colima", but I think vast majority of people
# are authing their docker through gcloud, not docker cli.
python3 <<'EOF'
import os
import json
with open(os.path.expanduser("~/.docker/config.json"), "rb") as f:
    config = json.loads(f.read())
    credsStore = config.get("credsStore")
    if credsStore is None:
        exit(0)
    config["oldCredsStore"] = credsStore
    del config["credsStore"]
with open(os.path.expanduser("~/.docker/config.json"), "w") as f:
    f.write(json.dumps(config))
EOF

echo "Installing colima."
brew install colima
brew link colima

echo "Starting colima."
python3 -uS scripts/start-colima.py

# The context will be colima, we just want to double make sure.
docker context use colima
echo "Recreating your postgres and clickhouse volume for use with colima. May take a few minutes."
# volume create is idempotent noop if already exists
docker volume create --name sentry_postgres
docker run --rm -v "${tmpdir}/postgres:/from" -v sentry_postgres:/to alpine ash -c "cd /from ; cp -a . /to"
docker run --rm -v "${tmpdir}/clickhouse:/from" -v sentry_clickhouse:/to alpine ash -c "cd /from ; cp -a . /to"
rm -rf "$tmpdir"

echo "-----------------------------------------------"
echo "All done. Start devservices at your discretion."
