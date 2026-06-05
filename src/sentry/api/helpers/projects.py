from __future__ import annotations

from collections.abc import Iterable
from typing import NamedTuple, TypeAlias

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from sentry.constants import ALL_ACCESS_PROJECTS_SLUG
from sentry.utils.slug import DEFAULT_SLUG_ERROR_MESSAGE, MIXED_SLUG_REGEX

ProjectIdOrSlug: TypeAlias = int | str


class ParsedProjectIdOrSlugParams(NamedTuple):
    ids: set[int]
    slugs: set[str]

    @property
    def has_values(self) -> bool:
        return bool(self.ids or self.slugs)


def _is_int_string(value: str) -> bool:
    return value.isdecimal() or (len(value) > 1 and value[0] == "-" and value[1:].isdecimal())


def parse_id_or_slug_params(
    values: Iterable[ProjectIdOrSlug | None],
) -> ParsedProjectIdOrSlugParams:
    """
    Partition project identifier values into numeric IDs and slugs.

    All-digit values are treated as IDs, everything else as slugs. A single
    leading ``-`` is allowed so the ``-1`` all-access project sigil remains a
    project ID.
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
        if _is_int_string(value_str):
            ids.add(int(value_str))
        else:
            slugs.add(value_str)
    return ParsedProjectIdOrSlugParams(ids=ids, slugs=slugs)


@extend_schema_field(field=OpenApiTypes.STR)
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
        if _is_int_string(data):
            return int(data)
        if data == ALL_ACCESS_PROJECTS_SLUG:
            return data
        if MIXED_SLUG_REGEX.match(data) is None:
            self.fail("invalid_slug")
        return data

    def to_representation(self, value: ProjectIdOrSlug) -> ProjectIdOrSlug:
        return value
