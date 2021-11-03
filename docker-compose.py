# TODO
# - conditionals with sentry settings... hmm
# - devservices pull=true
# - durable defaults, and make them less durable for IS_CI

import os
import sys
from tempfile import NamedTemporaryFile

import yaml

if len(sys.argv) < 2:
    sys.exit(
        """usage: docker-compose.py up|down
"""
    )

# todo: replace with argparse
cmd = sys.argv[1]

IS_CI = os.environ.get("IS_CI", True)  # todo: this is placeholder flag
NEED_REDIS = os.environ.get("NEED_REDIS", False)
NEED_POSTGRES = os.environ.get("NEED_POSTGRES", False)
NEED_SNUBA = os.environ.get("NEED_SNUBA", False)
NEED_CLICKHOUSE = os.environ.get("NEED_CLICKHOUSE", False)
NEED_KAFKA = os.environ.get("NEED_KAFKA", False)

base = """
version: "3.8"
services: {}
volumes: {}
"""

config = yaml.load(base, Loader=yaml.BaseLoader)

service_redis = """
image: "redis:5.0-alpine"
container_name: sentry_redis
ports:
  - "6379:6379"
command:
  [
    "redis-server",
    "--appendonly",
    "yes",
    "--save",
    "60",
    "20",
    "--auto-aof-rewrite-percentage",
    "100",
    "--auto-aof-rewrite-min-size",
    "64mb",
  ]
volumes:
  - "sentry-redis:/data"
deploy:
  x-restart-policy:
    condition: "none"
healthcheck:
  disable: true
"""

# TODO: could disable autovaccuum

service_postgres = """
image: "postgres:9.6-alpine"
container_name: sentry_postgres
ports:
  - "5432:5432"
command:
  [
    "postgres",
    "-c",
    "wal_level=logical",
    "-c",
    "max_replication_slots=1",
    "-c",
    "max_wal_senders=1",
  ]
environment:
  POSTGRES_DB: "sentry"
  POSTGRES_HOST_AUTH_METHOD: "trust"
volumes:
  - "sentry-postgres:/var/lib/postgresql/data"
deploy:
  x-restart-policy:
    condition: "none"
healthcheck:
  disable: true
"""

service_snuba = """
image: "getsentry/snuba:nightly"
container_name: sentry_snuba
ports:
  - "1218:1218"
command:
  [
    "devserver",
  ]
environment:
  PYTHONUNBUFFERED: "1"
  SNUBA_SETTINGS: "docker"
  DEBUG: "1"
  CLICKHOUSE_HOST: "sentry_clickhouse"
  CLICKHOUSE_PORT: "9000"
  CLICKHOUSE_HTTP_PORT: "8123"
  DEFAULT_BROKERS: "sentry_kafka:9093"
  REDIS_HOST: "sentry_redis"
  REDIS_PORT: "6379"
  REDIS_DB: "1"
deploy:
  x-restart-policy:
    condition: "none"
healthcheck:
  disable: true
"""

# TODO: match what we're running in production
# todo APPLE_ARM64 stuff and other conditionals
# i think zookeeper needs to be older
# see also 767bf793c18

service_clickhouse = """
image: "yandex/clickhouse-server:20.3.9.70"
container_name: sentry_clickhouse
ports:
  - "8123:8123"
  - "9000:9000"
  - "9009:9009"
ulimits:
  nofile:
    soft: 262144
    hard: 262144
volumes:
  - "sentry-clickhouse:/var/lib/clickhouse"
  - "sentry-clickhouse-log:/var/log/clickhouse-server"
  - "./config/clickhouse/loc_config.xml:/etc/clickhouse-server/config.d/sentry.xml:ro"
deploy:
  x-restart-policy:
    condition: "none"
healthcheck:
  disable: true
"""

service_kafka = """
image: "confluentinc/cp-kafka:5.1.2"
container_name: sentry_kafka
ports:
  - "9092:9092"
depends_on:
  - "zookeeper"
environment:
  KAFKA_ZOOKEEPER_CONNECT: "sentry_zookeeper:2181"
  KAFKA_LISTENERS: "INTERNAL://sentry_kafka:9093,EXTERNAL://sentry_kafka:9092"
  KAFKA_ADVERTISED_LISTENERS: "INTERNAL://sentry_kafka:9093,EXTERNAL://sentry_kafka:9092"
  KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: "INTERNAL:PLAINTEXT,EXTERNAL:PLAINTEXT"
  KAFKA_INTER_BROKER_LISTENER_NAME: "INTERNAL"
  KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: "1"
volumes:
  - "sentry-kafka:/var/lib/kafka/data"
  - "sentry-kafka-log:/var/lib/kafka/log"
deploy:
  x-restart-policy:
    condition: "none"
healthcheck:
  disable: true
"""

service_zookeeper = """
image: "confluentinc/cp-zookeeper:4.1.0"
container_name: sentry_zookeeper
ports:
  - "2181:2181"
environment:
    ZOOKEEPER_CLIENT_PORT: "2181"
deploy:
  x-restart-policy:
    condition: "none"
healthcheck:
  disable: true
"""

if NEED_REDIS:
    config["services"]["redis"] = yaml.load(service_redis, Loader=yaml.BaseLoader)
    config["volumes"]["sentry-redis"] = {}

if NEED_POSTGRES:
    config["services"]["postgres"] = yaml.load(service_postgres, Loader=yaml.BaseLoader)
    config["volumes"]["sentry-postgres"] = {}

if NEED_SNUBA:
    config["services"]["snuba"] = yaml.load(service_snuba, Loader=yaml.BaseLoader)

if NEED_CLICKHOUSE:
    config["services"]["clickhouse"] = yaml.load(service_clickhouse, Loader=yaml.BaseLoader)
    config["volumes"]["sentry-clickhouse"] = {}
    config["volumes"]["sentry-clickhouse-log"] = {}

if NEED_KAFKA:
    config["services"]["kafka"] = yaml.load(service_kafka, Loader=yaml.BaseLoader)
    config["volumes"]["sentry-kafka"] = {}
    config["volumes"]["sentry-kafka-log"] = {}
    config["services"]["zookeeper"] = yaml.load(service_zookeeper, Loader=yaml.BaseLoader)

with NamedTemporaryFile(mode="wt", delete=False) as f:
    commands = {
        "up": ["docker-compose", "-f", f.name, "up", "-d"],
        "down": ["docker-compose", "-f", f.name, "down"],
    }
    command = commands[cmd]
    manifest = yaml.dump(config)
    # todo: put behind debug flag for CI
    # print(manifest)
    f.write(manifest)

os.execvp(command[0], command)
