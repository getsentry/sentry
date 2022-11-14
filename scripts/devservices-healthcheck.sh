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


# Accepts following positional arguments:
# $1 - how many times to try
# $2 - delay between tries
# $3 - the service (docker container) name
# $4 - command to run inside the docker container
function health_check {
  local try=1
  local to=$1
  local start=0
  local delay=$2
  local service="$3"
  local cmd="$4"


  sleep "$start"
  echo "Running '$cmd' in '$service'"
  while (( $try <= $to )); do
      echo "Checking '$service' (try ${try} of ${to})..."
      if docker exec $service $cmd; then
          return 0
      fi

      if (( $try == $to )); then
          echo "Exceeded retries for '$service'"
          exit 1
      fi
      try=$(($try + 1))
      sleep "$delay"
  done
}

# Check the postgres status
health_check 3 5 "sentry_postgres" "pg_isready -U postgres"

# Check the kafka cluster status
if [ "$NEED_KAFKA" = "true" ]; then
  health_check 3 5 "sentry_kafka" "kafka-topics --zookeeper 127.0.0.1:2181 --list"
fi

# Make sure to exit with success if all previous checks are done
exit 0
