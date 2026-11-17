from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from rest_framework import serializers

from sentry.models.organization import Organization
from sentry.notebooks.models import Notebook, NotebookSourceType


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
    """A kind of thing a producer writes notebooks about, such as an issue.

    The create endpoint checks that the writer can reach the projects `resolve` returns.
    """

    name: str
    # Who writes these notebooks, such as "autofix".
    producer: str
    # Validates the `source` object a producer sends, without its `type` field.
    validator: type[serializers.Serializer[Any]]
    # Raise NotebookSourceNotFound for a missing source, and look up only within the organization.
    resolve: Callable[[Organization, dict[str, Any]], ResolvedProducerSource]

    def source_key(self, resolved: ResolvedProducerSource) -> str:
        return f"{self.name}:{resolved.key}"

    def notebook_source(self, resolved: ResolvedProducerSource) -> dict[str, Any]:
        return {**resolved.source, "type": self.name}

    # Producer blocks are stored under the producer's name, so callers send and get bare keys.
    def block_key(self, key: str) -> str:
        return f"{self.producer}:{key}"

    def caller_block_key(self, stored_key: str) -> str:
        return stored_key.removeprefix(f"{self.producer}:")


PRODUCER_SOURCE_TYPES: dict[str, ProducerSourceType] = {}


def _check_name(name: str) -> None:
    max_length = Notebook._meta.get_field("source_type").max_length
    if max_length is not None and len(name) > max_length:
        raise ValueError(f"{name} is longer than {max_length} characters.")
    # Names prefix keys as "<name>:<key>", so a ":" in one would let two keys collide.
    if ":" in name:
        raise ValueError(f"{name} can't contain ':'.")


def register_producer_source_type(source_type: ProducerSourceType) -> None:
    # The engine and manual notebooks have their own create paths.
    if source_type.name in NotebookSourceType.values:
        raise ValueError(f"{source_type.name} is not a producer source type.")
    _check_name(source_type.name)
    _check_name(source_type.producer)
    # Re-running ready() with the same type is fine; a different type under its name isn't.
    # One producer can own several source types, since each notebook has one source type.
    existing = PRODUCER_SOURCE_TYPES.setdefault(source_type.name, source_type)
    if existing != source_type:
        raise ValueError(f"{source_type.name!r} is already registered.")


def get_producer_source_type(source_type: str) -> ProducerSourceType | None:
    return PRODUCER_SOURCE_TYPES.get(source_type)


@dataclass(frozen=True)
class ProducerSource:
    """A producer's validated source."""

    source_type: ProducerSourceType
    resolved: ResolvedProducerSource
