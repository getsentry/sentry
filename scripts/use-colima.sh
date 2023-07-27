#!/bin/bash

echo "Stopping Docker.app. You may ignore a 'process terminated unexpectedly' dialog."

osascript - <<'EOF' || exit
tell application "Docker"
  if it is running then quit it
end tell
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
