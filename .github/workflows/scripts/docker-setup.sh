#!/bin/bash
# Contains code to automate the Docker initialization in CI

# This is mainly to be used by CI on Mac
# After using homebrew to install docker, we need to do some magic to remove the need to interact with the GUI
# See: https://github.com/docker/for-mac/issues/2359#issuecomment-607154849 for why we need to do things below
init-docker() {
    # Need to start docker if it was freshly installed or updated
    if query-mac; then
        if [ ! -f /Library/PrivilegedHelperTools/com.docker.vmnetd ]; then
            echo "Making some changes to complete Docker initialization"
            # allow the app to run without confirmation
            xattr -d -r com.apple.quarantine /Applications/Docker.app

            # preemptively do docker.app's setup to avoid any gui prompts
            sudo-askpass /bin/cp /Applications/Docker.app/Contents/Library/LaunchServices/com.docker.vmnetd /Library/PrivilegedHelperTools/
            sudo-askpass /bin/chmod 544 /Library/PrivilegedHelperTools/com.docker.vmnetd

            # This file used to be generated as part of brew's installation
            sudo-askpass /bin/cp .github/files/com.docker.vmnetd.plist /Library/LaunchDaemons/
            sudo-askpass /bin/chmod 644 /Library/LaunchDaemons/com.docker.vmnetd.plist
            sudo-askpass /bin/launchctl load /Library/LaunchDaemons/com.docker.vmnetd.plist
        fi
        # We need this for Mac since the executable docker won't work properly
        # until the app is opened once
        if ! docker system info &>/dev/null; then
            echo "About to open Docker.app"
            # At a later stage in the script, we're going to execute
            # ensure_docker_server which waits for it to be ready
            open -g -a Docker.app
        fi
    fi
}
