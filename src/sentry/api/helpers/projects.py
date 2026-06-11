from __future__ import annotations

from collections.abc import Iterable
from typing import NamedTuple, TypeAlias

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from sentry.constants import ALL_ACCESS_PROJECT_ID, ALL_ACCESS_PROJECTS_SLUG
from sentry.utils.slug import DEFAULT_SLUG_ERROR_MESSAGE, MIXED_SLUG_REGEX

ProjectIdOrSlug: TypeAlias = int | str


def coerce_id_or_slug(value: ProjectIdOrSlug) -> ProjectIdOrSlug:
    """
    Normalize a single project identifier into an ``int`` ID or ``str`` slug.

    This is the single source of truth for deciding whether a value is an ID or
    a slug: all-digit values and the ``-1`` all-access project sigil become
    ints, everything else (including the ``$all`` sigil) stays a slug string.

    It performs no slug-format validation and does not reject empty/``None``
    input -- callers layer those concerns on top (``ProjectIdOrSlugField`` adds
    strict validation; ``parse_id_or_slug_params`` skips empty values). This
    mirrors the decimal check in ``IdOrSlugLookup`` (the ``slug__id_or_slug`` DB
    lookup) while adding the project-specific ``-1`` sentinel, which the generic
    DB lookup intentionally omits.
    """
    if isinstance(value, int):
        return value
    if value.isdecimal() or value == str(ALL_ACCESS_PROJECT_ID):
        return int(value)
    return value


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
        parsed = coerce_id_or_slug(value)
        if isinstance(parsed, int) and not isinstance(parsed, bool):
            ids.add(parsed)
        else:
            slugs.add(str(parsed))
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
        if not isinstance(data, (int, str)) or data == "":
            self.fail("invalid")
        parsed = coerce_id_or_slug(data)
        if (
            isinstance(parsed, str)
            and parsed != ALL_ACCESS_PROJECTS_SLUG
            and MIXED_SLUG_REGEX.match(parsed) is None
        ):
            self.fail("invalid_slug")
        return parsed

    def to_representation(self, value: ProjectIdOrSlug) -> ProjectIdOrSlug:
        return value
