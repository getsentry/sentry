from django.test import override_settings

from sentry.conf.types.kafka_definition import Topic
from sentry.utils.kafka_config import get_topic_definition


def test_get_topic_definition_without_slice_id():
    with override_settings(
        KAFKA_TOPIC_TO_CLUSTER={"events": "default"},
        KAFKA_TOPIC_OVERRIDES={"events": "custom-events-topic"},
    ):
        topic_def = get_topic_definition(Topic.EVENTS)
        assert topic_def["cluster"] == "default"
        assert topic_def["real_topic_name"] == "custom-events-topic"


def test_get_topic_definition_no_override():
    with override_settings(
        KAFKA_TOPIC_TO_CLUSTER={"events": "default"},
        KAFKA_TOPIC_OVERRIDES={},
    ):
        topic_def = get_topic_definition(Topic.EVENTS)
        assert topic_def["cluster"] == "default"
        assert topic_def["real_topic_name"] == "events"


def test_get_topic_definition_with_slice_id():
    with override_settings(
        KAFKA_TOPIC_TO_CLUSTER={"events": "default"},
        KAFKA_TOPIC_OVERRIDES={"events": "custom-events-topic"},
        SLICED_KAFKA_TOPICS={
            ("events", 0): {"cluster": "slice-0", "topic": "events-slice-0"},
            ("events", 1): {"cluster": "slice-1", "topic": "events-slice-1"},
        },
    ):
        # Test slice 0
        topic_def = get_topic_definition(Topic.EVENTS, kafka_slice_id=0)
        assert topic_def["cluster"] == "slice-0"
        assert topic_def["real_topic_name"] == "events-slice-0"

        # Test slice 1
        topic_def = get_topic_definition(Topic.EVENTS, kafka_slice_id=1)
        assert topic_def["cluster"] == "slice-1"
        assert topic_def["real_topic_name"] == "events-slice-1"
