from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from rest_framework import serializers

from sentry.models.organization import Organization
from sentry.notebooks.models import NotebookSourceType


@dataclass(frozen=True)
class ResolvedProducerSource:
    # Unique within the source type.
    key: str
    # Stored as Notebook.source with the type added. Put identifying fields under "ref",
    # which the notebook response returns.
    source: dict[str, Any]
    project_ids: list[int]


@dataclass(frozen=True)
class ProducerSourceType:
    """A kind of thing a producer writes notebooks about, such as an issue."""

    name: str
    # Validates the `source` object a producer sends, without its `type` field.
    validator: type[serializers.Serializer[Any]]
    resolve: Callable[[Organization, dict[str, Any]], ResolvedProducerSource]

    def source_key(self, resolved: ResolvedProducerSource) -> str:
        return f"{self.name}:{resolved.key}"

    def notebook_source(self, resolved: ResolvedProducerSource) -> dict[str, Any]:
        return {**resolved.source, "type": self.name}


PRODUCER_SOURCE_TYPES: dict[str, ProducerSourceType] = {}

# Notebook.source_type holds the type name.
MAX_SOURCE_TYPE_LENGTH = 32


def register_producer_source_type(source_type: ProducerSourceType) -> None:
    # The engine and manual notebooks have their own create paths.
    if source_type.name in NotebookSourceType.values:
        raise ValueError(f"{source_type.name} is not a producer source type.")
    if len(source_type.name) > MAX_SOURCE_TYPE_LENGTH:
        raise ValueError(f"{source_type.name} is longer than {MAX_SOURCE_TYPE_LENGTH} characters.")
    PRODUCER_SOURCE_TYPES[source_type.name] = source_type


def get_producer_source_type(source_type: str) -> ProducerSourceType | None:
    return PRODUCER_SOURCE_TYPES.get(source_type)
