#!/bin/bash
# Module containing code shared across various shell scripts

# Check if a command is available
require() {
    command -v "$1" >/dev/null 2>&1
}

sudo_askpass() {
  if [ -z "${SUDO_ASKPASS-x}" ]; then
    sudo --askpass "$@"
  else
    sudo "$@"
  fi
}

# After using homebrew to install docker, we need to do some magic to remove the need to interact with the GUI
# See: https://github.com/docker/for-mac/issues/2359#issuecomment-607154849 for why we need to do things below
init_docker() {
  # Need to start docker if it was freshly installed (docker server is not running)
  if ! command -v docker &>/dev/null && [ -d "/Applications/Docker.app" ]; then
    echo "Making some changes to complete Docker initialization"
    # allow the app to run without confirmation
    xattr -d -r com.apple.quarantine /Applications/Docker.app

    # preemptively do docker.app's setup to avoid any gui prompts
    sudo_askpass /bin/mkdir -p /Library/PrivilegedHelperTools
    sudo_askpass /bin/chmod 754 /Library/PrivilegedHelperTools
    sudo_askpass /bin/cp /Applications/Docker.app/Contents/Library/LaunchServices/com.docker.vmnetd /Library/PrivilegedHelperTools/
    sudo_askpass /bin/cp /Applications/Docker.app/Contents/Resources/com.docker.vmnetd.plist /Library/LaunchDaemons/
    sudo_askpass /bin/chmod 544 /Library/PrivilegedHelperTools/com.docker.vmnetd
    sudo_askpass /bin/chmod 644 /Library/LaunchDaemons/com.docker.vmnetd.plist
    sudo_askpass /bin/launchctl load /Library/LaunchDaemons/com.docker.vmnetd.plist
  fi
  start_docker
}

start_docker() {
  if ! docker system info &>/dev/null; then
    echo "About to open Docker.app"
    # At a later stage in the script, we're going to execute
    # ensure_docker_server which waits for it to be ready
    open -g -a Docker.app
  fi
}

# Open Docker.app and wait for docker server to be ready
ensure_docker_server() {
  if [ -d "/Applications/Docker.app" ]; then
    echo "Starting Docker.app, if necessary..."

    # taken from https://github.com/docker/for-mac/issues/2359#issuecomment-607154849
    # Wait for the server to start up, if applicable.
    local i=0
    while ! docker system info &>/dev/null; do
      (( i++ == 0 )) && printf %s '-- Waiting for Docker to finish starting up...' || printf '.'
      sleep 1
    done
    (( i )) && printf '\n'
  fi
}

# Open Docker.app and wait for docker server to be ready
ensure_docker_server() {
  if [ -d "/Applications/Docker.app" ]; then
    echo "Starting Docker.app, if necessary..."

    # taken from https://github.com/docker/for-mac/issues/2359#issuecomment-607154849
    # Wait for the server to start up, if applicable.
    local i=0
    while ! docker system info &>/dev/null; do
      (( i++ == 0 )) && printf %s '-- Waiting for Docker to finish starting up...' || printf '.'
      sleep 1
    done
    (( i )) && printf '\n'
  fi
}

query_big_sur() {
    if require sw_vers && sw_vers -productVersion | grep -E "11\." > /dev/null; then
        return 0
    fi
    return 1
}
