#!/bin/bash
# Stands in for kafka-topics inside the CI Kafka container (see backend.yml).
# The healthcheck's exact command gets a TCP probe instead of a JVM start;
# anything else runs the real kafka-topics.
if [ "$*" = "--bootstrap-server 127.0.0.1:9092 --list" ] &&
  (exec 3<>/dev/tcp/127.0.0.1/9092) 2>/dev/null; then
  exit 0
fi
exec "$0.real" "$@"
