# Every topic is mapped to a cluster
from django.conf import settings

from sentry.conf.types.topic_definition import Topic


def test_topic_definition() -> None:
    for topic in Topic:
        assert topic.value in settings.KAFKA_TOPIC_TO_CLUSTER
    assert len(Topic) == len(settings.KAFKA_TOPIC_TO_CLUSTER)
