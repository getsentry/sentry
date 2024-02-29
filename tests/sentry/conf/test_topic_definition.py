from django.conf import settings

from sentry.conf.types.topic_definition import Topic


def test_topic_definition() -> None:
    for topic in Topic:
        cluster_name = settings.KAFKA_TOPIC_TO_CLUSTER[topic.value]
        assert (
            cluster_name in settings.KAFKA_CLUSTERS
        ), f"{cluster_name} is not defined in KAFKA_CLUSTERS"
    assert len(Topic) == len(settings.KAFKA_TOPIC_TO_CLUSTER)
