from __future__ import annotations

from typing import TypedDict


class TopicDefinition(TypedDict):
    cluster: str
    # The topic name may be overridden from the default via KAFKA_TOPIC_OVERRIDES
    real_topic_name: str
