from __future__ import annotations

from collections.abc import Iterable
from typing import NamedTuple, TypeAlias

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from sentry.constants import ALL_ACCESS_PROJECT_ID, ALL_ACCESS_PROJECTS_SLUG
from sentry.utils.slug import DEFAULT_SLUG_ERROR_MESSAGE, MIXED_SLUG_REGEX

ProjectIdOrSlug: TypeAlias = int | str

PROJECT_ID_OR_SLUG_SCHEMA = {"anyOf": [{"type": "integer"}, {"type": "string"}]}


class ParsedProjectIdOrSlugParams(NamedTuple):
    ids: set[int]
    slugs: set[str]

    @property
    def has_values(self) -> bool:
        return bool(self.ids or self.slugs)

    @property
    def has_all_projects_sentinel(self) -> bool:
        return ALL_ACCESS_PROJECT_ID in self.ids or ALL_ACCESS_PROJECTS_SLUG in self.slugs


def parse_id_or_slug_params(
    values: Iterable[ProjectIdOrSlug | None],
) -> ParsedProjectIdOrSlugParams:
    """
    Partition project identifier values into numeric IDs and slugs.

    All-digit values and the ``-1`` all-access project sigil are treated as IDs.
    Everything else is treated as a slug.
    """
    ids: set[int] = set()
    slugs: set[str] = set()
    for value in values:
        if value is None or value == "":
            continue
        if isinstance(value, int) and not isinstance(value, bool):
            ids.add(value)
            continue

        value_str = str(value)
        if value_str.isdecimal() or value_str == str(ALL_ACCESS_PROJECT_ID):
            ids.add(int(value_str))
        else:
            slugs.add(value_str)
    return ParsedProjectIdOrSlugParams(ids=ids, slugs=slugs)


@extend_schema_field(field=PROJECT_ID_OR_SLUG_SCHEMA)
class ProjectIdOrSlugField(serializers.Field[ProjectIdOrSlug, object, ProjectIdOrSlug, object]):
    default_error_messages = {
        "invalid": "Expected a project ID or slug.",
        "invalid_slug": DEFAULT_SLUG_ERROR_MESSAGE,
    }

    def to_internal_value(self, data: object) -> ProjectIdOrSlug:
        if data is None or isinstance(data, bool):
            self.fail("invalid")
        if isinstance(data, int):
            return data
        if not isinstance(data, str) or data == "":
            self.fail("invalid")
        if data.isdecimal() or data == str(ALL_ACCESS_PROJECT_ID):
            return int(data)
        if data == ALL_ACCESS_PROJECTS_SLUG:
            return data
        if MIXED_SLUG_REGEX.match(data) is None:
            self.fail("invalid_slug")
        return data

    def to_representation(self, value: ProjectIdOrSlug) -> ProjectIdOrSlug:
        return value
