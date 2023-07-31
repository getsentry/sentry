#!/bin/bash

set -e

colima stop

echo "Using docker cli from cask. You may be prompted for your password."
# brew --prefix doesn't seem to apply here - it's just /usr/local
sudo ln -svf /Applications/Docker.app/Contents/Resources/bin/docker "/usr/local/bin/docker"

# this restores the old credsStore value
python3 <<'EOF'
import os
import json
with open(os.path.expanduser("~/.docker/config.json"), "rb") as f:
    config = json.loads(f.read())
    oldCredsStore = config.get("oldCredsStore")
    if oldCredsStore is None:
        exit(0)
    config["credsStore"] = oldCredsStore
    del config["oldCredsStore"]
with open(os.path.expanduser("~/.docker/config.json"), "w") as f:
    f.write(json.dumps(config))
EOF

echo "Unlinking colima."
brew unlink colima

echo "Starting Docker."
open -a /Applications/Docker.app --args --unattended

echo "-----------------------------------------------"
echo "All done. Start devservices at your discretion."
