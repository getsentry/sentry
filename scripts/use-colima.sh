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

echo "Installing colima."
brew install colima
brew link colima
