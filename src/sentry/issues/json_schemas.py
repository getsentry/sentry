import logging

from sentry_kafka_schemas import SchemaNotFound, sentry_kafka_schemas

logger = logging.getLogger(__name__)

try:
    EVENT_PAYLOAD_SCHEMA = sentry_kafka_schemas._get_schema("generic-events")["schema"]
except SchemaNotFound:
    logger.exception("Failed to load Events schema from Kafka schemas")
    raise
