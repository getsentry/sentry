"""
The custom symbol sources stored in a project's `sentry:symbol_sources` option.
"""

from __future__ import annotations

from copy import deepcopy
from typing import Any, TypeAlias
from uuid import uuid4

import jsonschema
import orjson
import sentry_sdk

from sentry.lang.native.source_kinds import LEGACY_SOURCE_TYPES, SECRET_FIELDS, SOURCES_SCHEMA
from sentry.lang.native.source_schema import HIDDEN_SECRET
from sentry.models.project import Project

Source: TypeAlias = dict[str, Any]
"""A symbol source as stored in the project option. Its key set depends on the kind."""


class InvalidSourcesError(Exception):
    pass


def is_internal_source_id(source_id: str) -> bool:
    """Whether a source ID is reserved for Sentry's own sources."""
    return source_id.startswith("sentry")


def validate_sources(sources: list[Source]) -> None:
    """Checks the sources against the JSON schema and rejects reserved or duplicate IDs."""
    try:
        jsonschema.validate(sources, SOURCES_SCHEMA)
    except jsonschema.ValidationError:
        raise InvalidSourcesError(f"Failed to validate source {redact_source_secrets(sources)}")

    ids = set()
    for source in sources:
        if is_internal_source_id(source["id"]):
            raise InvalidSourcesError('Source ids must not start with "sentry:"')
        if source["id"] in ids:
            raise InvalidSourcesError("Duplicate source id: {}".format(source["id"]))
        ids.add(source["id"])


def parse_sources(config):
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

    sources = [src for src in sources if src.get("type") not in LEGACY_SOURCE_TYPES]
    validate_sources(sources)

    return sources


def parse_backfill_sources(sources_json, original_sources):
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

    orig_by_id = {src["id"]: src for src in original_sources}

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


def redact_source_secrets(config_sources: Any) -> Any:
    """
    Returns a json data with all of the secrets redacted from every source.

    The original value is not mutated in the process; A clone is created
    and returned by this function.
    """

    redacted_sources = deepcopy(config_sources)
    for source in redacted_sources:
        for field in SECRET_FIELDS:
            if field in source:
                source[field] = HIDDEN_SECRET

    return redacted_sources


class UnknownSourceId(Exception):
    pass


class ProjectSymbolSources:
    """
    The custom symbol sources of one project.

    Hides the `sentry:symbol_sources` project option, its JSON encoding, and
    secret handling. Every mutation validates the whole list and saves it, so
    a caller cannot store an invalid list or forget to save. Every source that
    leaves this class has its secrets redacted.
    """

    OPTION = "sentry:symbol_sources"

    def __init__(self, project: Project, sources: list[Source]) -> None:
        self._project = project
        self._sources = sources

    @classmethod
    def load(cls, project: Project) -> ProjectSymbolSources:
        config = project.get_option(cls.OPTION)
        return cls(project, parse_sources(config))

    def all(self) -> list[Source]:
        return redact_source_secrets(self._sources)

    def get(self, source_id: str | None) -> Source:
        return redact_source_secrets([self._sources[self._index_of(source_id)]])[0]

    def add(self, source: Source) -> Source:
        source = {**source}
        source.setdefault("id", str(uuid4()))
        self._save([*self._sources, source])
        return redact_source_secrets([source])[0]

    def replace(self, source_id: str | None, source: Source) -> Source:
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
        return redact_source_secrets([source])[0]

    def remove(self, source_id: str | None) -> None:
        index = self._index_of(source_id)
        self._save([*self._sources[:index], *self._sources[index + 1 :]])

    def _index_of(self, source_id: str | None) -> int:
        if source_id is None:
            raise UnknownSourceId("Missing source id")
        for index, source in enumerate(self._sources):
            if source["id"] == source_id:
                return index
        raise UnknownSourceId(f"Unknown source id: {source_id}")

    def _save(self, sources: list[Source]) -> None:
        validate_sources(sources)
        self._project.update_option(self.OPTION, orjson.dumps(sources).decode())
        self._sources = sources
