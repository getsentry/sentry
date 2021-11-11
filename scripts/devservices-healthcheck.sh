#!/bin/bash

# This is used for healthchecking because docker running healthchecks
# keeps the CPU too warm and if a container becomes unhealthy, there's no
# notification system or anything that would make it more easily visible.

# In the future, more healthchecks should be added to make it more helpful
# as a troubleshooting script. Right now this is just used by CI.

# TODO: iterate through all sentry_ containers,
#       and warn on anything that's expected to run but isn't running.
# TODO: spawn subprocess for each container,
#       specify distinct retries and other parameters.
#       would also be nice to have a single ^C work.

try=1
to=3
start=0
delay=5

sleep "$start"
while (( $try <= $to )); do
    echo "Checking health of postgres (try ${try} of ${to})..."
    if docker exec sentry_postgres pg_isready -U postgres; then
        break
    fi
    if (( $try == $to )); then
        echo "Exceeded retries."
        exit 1
    fi
    try=$(($try + 1))
    sleep "$delay"
done
