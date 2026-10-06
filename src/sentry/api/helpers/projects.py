from __future__ import annotations

from collections.abc import Iterable
from typing import NamedTuple, TypeAlias

from django.http.request import HttpRequest
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from sentry.auth.staff import is_active_staff
from sentry.auth.superuser import is_active_superuser
from sentry.constants import ALL_ACCESS_PROJECT_ID, ALL_ACCESS_PROJECTS_SLUG, ObjectStatus
from sentry.models.project import Project
from sentry.utils.slug import DEFAULT_SLUG_ERROR_MESSAGE, MIXED_SLUG_REGEX
from sentry.utils.tracing import set_span_data, set_span_tag, start_span

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


def filter_projects_by_permissions(
    projects: list[Project],
    request: HttpRequest,
    filter_by_membership: bool = False,
    force_global_perms: bool = False,
    include_all_accessible: bool = False,
) -> list[Project]:
    """
    Filter ``projects`` down to the ones the request is allowed to read.

    ``include_all_accessible`` grants org-wide access to members of open-membership
    organizations; otherwise access falls back to team membership.
    """
    with start_span(op="apply_project_permissions", name="apply_project_permissions") as span:
        set_span_data(span, "Project Count", len(projects))
        if force_global_perms:
            set_span_tag(span, "mode", "force_global_perms")
            return projects

        # There is a special case for staff, where we want to fetch a single project (OrganizationStatsEndpointV2)
        # or all projects (OrganizationMetricsDetailsEndpoint) in _admin. Staff cannot use has_project_access
        # like superuser because it fails due to staff having no scopes. The workaround is to create a lambda that
        # mimics checking for active projects like has_project_access without further validation.
        # NOTE: We must check staff before superuser or else _admin will fail when both cookies are active
        if is_active_staff(request):
            set_span_tag(span, "mode", "staff_fetch_all")
            proj_filter = lambda proj: proj.status == ObjectStatus.ACTIVE  # noqa: E731
        # Superuser should fetch all projects.
        # Also fetch all accessible projects if requesting $all
        elif is_active_superuser(request) or include_all_accessible:
            set_span_tag(span, "mode", "has_project_access")
            proj_filter = request.access.has_project_access
        # Check if explicitly requesting specific projects
        elif not filter_by_membership:
            set_span_tag(span, "mode", "has_project_access")
            proj_filter = request.access.has_project_access
        else:
            set_span_tag(span, "mode", "has_project_membership")
            proj_filter = request.access.has_project_membership

        return [p for p in projects if proj_filter(p)]


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
