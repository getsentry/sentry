"""
The custom symbol sources stored in a project's `sentry:symbol_sources` option.
"""

from __future__ import annotations

from collections.abc import Iterator, Mapping
from copy import deepcopy
from typing import Any, TypeAlias
from uuid import uuid4

import orjson
import sentry_sdk

from sentry.lang.native.source_kinds import (
    HIDDEN_SECRET,
    SECRET_FIELDS,
    SOURCE_SERIALIZERS,
    is_internal_source_id,
)
from sentry.models.project import Project

Source: TypeAlias = dict[str, Any]
"""A symbol source as stored in the project option. Its key set depends on the kind."""

# Sentry no longer supports App Store Connect sources. Old project options may
# still contain them.
LEGACY_SOURCE_TYPE = "appStoreConnect"


class InvalidSourcesError(Exception):
    pass


class UnknownSourceId(Exception):
    pass


def validate_sources(sources: list[Source]) -> None:
    """
    Checks every source with the serializer of its kind and rejects sources
    with a missing, reserved, or duplicate ID.
    """
    ids: set[str] = set()
    for source in sources:
        _validate_source(source)
        source_id = source["id"]
        if is_internal_source_id(source_id):
            raise InvalidSourcesError('Source ids must not start with "sentry:"')
        if source_id in ids:
            raise InvalidSourcesError(f"Duplicate source id: {source_id}")
        ids.add(source_id)


def _validate_source(source: Source) -> None:
    source_type = source.get("type")
    serializer_class = SOURCE_SERIALIZERS.get(source_type) if isinstance(source_type, str) else None
    if serializer_class is None:
        raise InvalidSourcesError(f"Unknown source type: {source_type!r}")
    serializer = serializer_class(data=source)
    if not serializer.is_valid():
        problems = "; ".join(_describe_errors(serializer.errors))
        raise InvalidSourcesError(f"Invalid {source_type} source: {problems}")
    if "id" not in source:
        raise InvalidSourcesError("Source is missing an id")


def _describe_errors(errors: Mapping[Any, Any], prefix: str = "") -> Iterator[str]:
    for name, detail in errors.items():
        path = f"{prefix}{name}"
        if isinstance(detail, Mapping):
            yield from _describe_errors(detail, f"{path}.")
        else:
            yield f"{path}: {' '.join(str(message) for message in detail)}"


def parse_sources(config: str | None) -> list[Source]:
    """
    Parses the sources stored in a project option. Sources of a kind Sentry no
    longer supports are dropped.
    """
    if not config:
        return []

    try:
        sources = orjson.loads(config)
    except Exception as e:
        raise InvalidSourcesError("Sources are not valid serialised JSON") from e

    sources = [source for source in sources if source.get("type") != LEGACY_SOURCE_TYPE]
    validate_sources(sources)
    return sources


def parse_backfill_sources(sources_json: str, original_sources: list[Source]) -> list[Source]:
    """
    Parses a json string of sources passed in from a client and backfills any redacted secrets by
    finding their previous values stored in original_sources.
    """
    if not sources_json:
        return []

    try:
        sources = orjson.loads(sources_json)
    except Exception as e:
        raise InvalidSourcesError("Sources are not valid serialised JSON") from e

    orig_by_id = {source["id"]: source for source in original_sources}
    for source in sources:
        backfill_secrets(source, orig_by_id.get(source["id"]))

    validate_sources(sources)
    return sources


def backfill_secrets(source: Source, previous: Source | None) -> None:
    """
    Replaces every `{"hidden-secret": true}` placeholder in `source` with the
    real value from `previous`, the stored source it updates.
    """
    for field in SECRET_FIELDS:
        if source.get(field) != HIDDEN_SECRET:
            continue
        value = previous.get(field) if previous else None
        if value is None:
            with sentry_sdk.isolation_scope():
                sentry_sdk.set_tag("missing_secret", field)
                sentry_sdk.set_tag("source_id", source.get("id"))
                sentry_sdk.capture_message(
                    "Obfuscated symbol source secret does not have a corresponding saved value in project options"
                )
            raise InvalidSourcesError("Hidden symbol source secret is missing a value")
        source[field] = value


def redact_source(source: Source) -> Source:
    """Returns a copy of the source with every secret replaced by the hidden-secret placeholder."""
    redacted = deepcopy(source)
    for field in SECRET_FIELDS:
        if field in redacted:
            redacted[field] = HIDDEN_SECRET
    return redacted


def redact_source_secrets(sources: list[Source]) -> list[Source]:
    return [redact_source(source) for source in sources]


class ProjectSymbolSources:
    """
    The custom symbol sources of one project.

    Hides the `sentry:symbol_sources` project option, its JSON encoding, and
    secret handling. Every mutation validates the whole list and saves it, so
    a caller cannot store an invalid list or forget to save. Every source that
    leaves this class has its secrets redacted.
    """

    OPTION = "sentry:symbol_sources"

    def __init__(self, project: Project) -> None:
        self._project = project
        self._sources = parse_sources(project.get_option(self.OPTION))

    def all(self) -> list[Source]:
        return redact_source_secrets(self._sources)

    def get(self, source_id: str) -> Source:
        return redact_source(self._sources[self._index_of(source_id)])

    def add(self, source: Source) -> Source:
        source = {**source}
        source.setdefault("id", str(uuid4()))
        self._save([*self._sources, source])
        return redact_source(source)

    def replace(self, source_id: str, source: Source) -> Source:
        """
        Replaces the source with `source_id` by `source`. The new source keeps
        its own ID, or gets a fresh one when it has none. Hidden secrets in
        `source` are backfilled from the source it replaces.
        """
        index = self._index_of(source_id)
        source = {**source}
        source.setdefault("id", str(uuid4()))
        backfill_secrets(source, self._sources[index])
        self._save([*self._sources[:index], source, *self._sources[index + 1 :]])
        return redact_source(source)

    def remove(self, source_id: str) -> None:
        index = self._index_of(source_id)
        self._save([*self._sources[:index], *self._sources[index + 1 :]])

    def _index_of(self, source_id: str) -> int:
        for index, source in enumerate(self._sources):
            if source["id"] == source_id:
                return index
        raise UnknownSourceId(f"Unknown source id: {source_id}")

    def _save(self, sources: list[Source]) -> None:
        validate_sources(sources)
        self._project.update_option(self.OPTION, orjson.dumps(sources).decode())
        self._sources = sources
