from __future__ import annotations

from typing import TypedDict

from typing_extensions import Required


class TopicDefinition(TypedDict, total=False):
    cluster: Required[str]
    topic_name: str


class NormalizedTopicDefinition(TypedDict):
    cluster: str
    topic_name: str
