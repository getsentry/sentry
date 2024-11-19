#!/bin/bash

POSTGRES_CONTAINER="sentry_postgres"
USE_NEW_DEVSERVICES=${USE_NEW_DEVSERVICES:-"0"}
if [ "$USE_NEW_DEVSERVICES" == "1" ]; then
    POSTGRES_CONTAINER="sentry-postgres-1"
fi

if ! [[ -x ~/.local/share/sentry-devenv/bin/colima ]]; then
    echo "You need to install devenv! https://github.com/getsentry/devenv/#install"
    exit 1
fi

if [[ "$(sysctl -n machdep.cpu.brand_string)" != Intel* ]]; then
    case "$(sw_vers -productVersion)" in
        *12.*|*13.*)
            echo "Your ARM Mac is on a version incompatible with colima."
            echo "Use Docker Desktop for now until you upgrade to at least MacOS 14."
            exit 1
            ;;
    esac
fi

echo "Copying your postgres volume for use with colima. Will take a few minutes."
tmpdir=$(mktemp -d)
docker context use desktop-linux
docker run --rm -v $POSTGRES_CONTAINER:/from -v "${tmpdir}:/to" alpine ash -c "cd /from ; cp -a . /to" || { echo "You need to start Docker Desktop."; exit 1; }

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

echo "Starting colima."
devenv colima start

echo "Recreating your postgres volume for use with colima. May take a few minutes."
docker volume create --name $POSTGRES_CONTAINER
docker run --rm -v "${tmpdir}:/from" -v $POSTGRES_CONTAINER:/to alpine ash -c "cd /from ; cp -a . /to"
rm -rf "$tmpdir"

echo "-----------------------------------------------"
echo "All done. Start devservices at your discretion."
