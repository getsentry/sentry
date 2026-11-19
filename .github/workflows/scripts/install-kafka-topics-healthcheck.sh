#!/bin/sh
# Replaces kafka-topics in the kafka-kafka-1 container with
# kafka-topics-healthcheck.sh, so the healthcheck's `kafka-topics --list` is a
# TCP probe instead of a JVM start. Run it once everything that waits on
# Kafka's health is up.
set -eu

script_dir=$(dirname "$0")
real=$(docker exec kafka-kafka-1 sh -c 'command -v kafka-topics')
docker exec -u 0 kafka-kafka-1 mv "$real" "$real.real"
docker cp "$script_dir/kafka-topics-healthcheck.sh" "kafka-kafka-1:$real"
time docker exec kafka-kafka-1 kafka-topics --bootstrap-server 127.0.0.1:9092 --list
