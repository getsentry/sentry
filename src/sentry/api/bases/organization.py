from __future__ import annotations

from typing import Any, Optional, Set

import sentry_sdk
from django.core.cache import cache
from django.http.request import HttpRequest
from rest_framework.exceptions import ParseError, PermissionDenied
from rest_framework.request import Request

from sentry.api.base import Endpoint, resolve_region
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.helpers.environments import get_environments
from sentry.api.permissions import SentryPermission
from sentry.api.utils import (
    InvalidParams,
    get_date_range_from_params,
    is_member_disabled_from_limit,
)
from sentry.auth.superuser import is_active_superuser
from sentry.constants import ALL_ACCESS_PROJECTS, ALL_ACCESS_PROJECTS_SLUG
from sentry.models import ApiKey, Organization, Project, ProjectStatus, ReleaseProject
from sentry.models.environment import Environment
from sentry.models.release import Release
from sentry.utils import auth
from sentry.utils.hashlib import hash_values
from sentry.utils.numbers import format_grouped_length
from sentry.utils.sdk import bind_organization_context, set_measurement


class NoProjects(Exception):
    pass


class OrganizationPermission(SentryPermission):
    scope_map = {
        "GET": ["org:read", "org:write", "org:admin"],
        "POST": ["org:write", "org:admin"],
        "PUT": ["org:write", "org:admin"],
        "DELETE": ["org:admin"],
    }

    def is_not_2fa_compliant(self, request: Request, organization: Organization) -> bool:
        return (
            organization.flags.require_2fa
            and not request.user.has_2fa()
            and not is_active_superuser(request)
        )

    def needs_sso(self, request: Request, organization: Organization) -> bool:
        # XXX(dcramer): this is very similar to the server-rendered views
        # logic for checking valid SSO
        if not request.access.requires_sso:
            return False
        if not auth.has_completed_sso(request, organization.id):
            return True
        if not request.access.sso_is_valid:
            return True
        return False

    def has_object_permission(
        self, request: Request, view: object, organization: Organization
    ) -> bool:
        self.determine_access(request, organization)
        allowed_scopes = set(self.scope_map.get(request.method, []))
        return any(request.access.has_scope(s) for s in allowed_scopes)

    def is_member_disabled_from_limit(self, request: Request, organization: Organization) -> bool:
        return is_member_disabled_from_limit(request, organization)


class OrganizationAuditPermission(OrganizationPermission):
    scope_map = {"GET": ["org:write"]}


class OrganizationEventPermission(OrganizationPermission):
    scope_map = {
        "GET": ["event:read", "event:write", "event:admin"],
        "POST": ["event:write", "event:admin"],
        "PUT": ["event:write", "event:admin"],
        "DELETE": ["event:admin"],
    }


# These are based on ProjectReleasePermission
# additional checks to limit actions to releases
# associated with projects people have access to
class OrganizationReleasePermission(OrganizationPermission):
    scope_map = {
        "GET": ["project:read", "project:write", "project:admin", "project:releases"],
        "POST": ["project:write", "project:admin", "project:releases"],
        "PUT": ["project:write", "project:admin", "project:releases"],
        "DELETE": ["project:admin", "project:releases"],
    }


class OrganizationIntegrationsPermission(OrganizationPermission):
    scope_map = {
        "GET": ["org:read", "org:write", "org:admin", "org:integrations"],
        "POST": ["org:write", "org:admin", "org:integrations"],
        "PUT": ["org:write", "org:admin", "org:integrations"],
        "DELETE": ["org:admin", "org:integrations"],
    }


class OrganizationIntegrationsLoosePermission(OrganizationPermission):
    scope_map = {
        "GET": ["org:read", "org:write", "org:admin", "org:integrations"],
        "POST": ["org:read", "org:write", "org:admin", "org:integrations"],
        "PUT": ["org:read", "org:write", "org:admin", "org:integrations"],
        "DELETE": ["org:admin", "org:integrations"],
    }


class OrganizationAdminPermission(OrganizationPermission):
    scope_map = {
        "GET": ["org:admin"],
        "POST": ["org:admin"],
        "PUT": ["org:admin"],
        "DELETE": ["org:admin"],
    }


class OrganizationAuthProviderPermission(OrganizationPermission):
    scope_map = {
        "GET": ["org:read"],
        "POST": ["org:admin"],
        "PUT": ["org:admin"],
        "DELETE": ["org:admin"],
    }


class OrganizationUserReportsPermission(OrganizationPermission):
    scope_map = {"GET": ["project:read", "project:write", "project:admin"]}


class OrganizationPinnedSearchPermission(OrganizationPermission):
    scope_map = {
        "PUT": ["org:read", "org:write", "org:admin"],
        "DELETE": ["org:read", "org:write", "org:admin"],
    }


class OrganizationSearchPermission(OrganizationPermission):
    scope_map = {
        "GET": ["org:read", "org:write", "org:admin"],
        "POST": ["org:read", "org:write", "org:admin"],
        "PUT": ["org:read", "org:write", "org:admin"],
        "DELETE": ["org:read", "org:write", "org:admin"],
    }


class OrganizationDataExportPermission(OrganizationPermission):
    scope_map = {
        "GET": ["event:read", "event:write", "event:admin"],
        "POST": ["event:read", "event:write", "event:admin"],
    }


class OrganizationAlertRulePermission(OrganizationPermission):
    scope_map = {
        "GET": ["org:read", "org:write", "org:admin", "alert_rule:read"],
        "POST": ["org:write", "org:admin", "alert_rule:write"],
        "PUT": ["org:write", "org:admin", "alert_rule:write"],
        "DELETE": ["org:write", "org:admin", "alert_rule:write"],
    }


class OrganizationEndpoint(Endpoint):  # type: ignore[misc]
    permission_classes = (OrganizationPermission,)

    def get_projects(
        self,
        request: HttpRequest,
        organization: Organization,
        force_global_perms: bool = False,
        include_all_accessible: bool = False,
        project_ids: set[int] | None = None,
        project_slugs: set[str] | None = None,
    ) -> list[Project]:
        """
        Determines which project ids to filter the endpoint by. If a list of
        project ids is passed in via the `project` querystring argument then
        validate that these projects can be accessed. If not passed, then
        return all project ids that the user can access within this
        organization.

        :param request:
        :param organization: Organization to fetch projects for
        :param force_global_perms: Permission override. Allows subclasses to
        perform their own validation and allow the user to access any project
        in the organization. This is a hack to support the old
        `request.auth.has_scope` way of checking permissions, don't use it
        for anything else, we plan to remove this once we remove uses of
        `auth.has_scope`.
        :param include_all_accessible: Whether to factor the organization
        allow_joinleave flag into permission checks. We should ideally
        standardize how this is used and remove this parameter.
        :param project_ids: Projects if they were passed via request
        data instead of get params
        :return: A list of Project objects, or raises PermissionDenied.
        """
        if project_ids is None:
            slugs = project_slugs or set(filter(None, request.GET.getlist("projectSlug")))
            if ALL_ACCESS_PROJECTS_SLUG in slugs:
                project_ids = ALL_ACCESS_PROJECTS
            elif slugs:
                projects = Project.objects.filter(
                    organization=organization, slug__in=slugs
                ).values_list("id", flat=True)
                project_ids = set(projects)

                # return early to prevent passing empty set of project_ids to _get_projects_by_id
                # which would return all projects in the organization
                if not project_ids:
                    return []
            else:
                project_ids = self.get_requested_project_ids_unchecked(request)

        return self._get_projects_by_id(
            project_ids,
            request,
            organization,
            force_global_perms,
            include_all_accessible,
        )

    def _get_projects_by_id(
        self,
        project_ids: set[int],
        request: HttpRequest,
        organization: Organization,
        force_global_perms: bool = False,
        include_all_accessible: bool = False,
    ) -> list[Project]:
        qs = Project.objects.filter(organization=organization, status=ProjectStatus.VISIBLE)
        user = getattr(request, "user", None)
        # A project_id of -1 means 'all projects I have access to'
        # While no project_ids means 'all projects I am a member of'.
        if project_ids == ALL_ACCESS_PROJECTS:
            include_all_accessible = True
            project_ids = set()

        requested_projects = project_ids.copy()
        if project_ids:
            qs = qs.filter(id__in=project_ids)

        with sentry_sdk.start_span(op="fetch_organization_projects") as span:
            projects = list(qs)
            span.set_data("Project Count", len(projects))
        with sentry_sdk.start_span(op="apply_project_permissions") as span:
            span.set_data("Project Count", len(projects))
            if force_global_perms:
                span.set_tag("mode", "force_global_perms")
            else:
                if (
                    user
                    and is_active_superuser(request)
                    or requested_projects
                    or include_all_accessible
                ):
                    span.set_tag("mode", "has_project_access")
                    func = request.access.has_project_access
                else:
                    span.set_tag("mode", "has_project_membership")
                    func = request.access.has_project_membership
                projects = [p for p in qs if func(p)]

        project_ids = {p.id for p in projects}

        if requested_projects and project_ids != requested_projects:
            raise PermissionDenied

        return projects

    def get_requested_project_ids_unchecked(self, request: Request) -> set[int]:
        """
        Returns the project ids that were requested by the request.

        To determine the projects to filter this endpoint by with full
        permission checking, use ``get_projects``, instead.
        """
        try:
            return set(map(int, request.GET.getlist("project")))
        except ValueError:
            raise ParseError(detail="Invalid project parameter. Values must be numbers.")

    def get_environments(self, request: Request, organization: Organization) -> list[Environment]:
        return get_environments(request, organization)

    def get_filter_params(
        self,
        request: Request,
        organization: Organization,
        date_filter_optional: bool = False,
        project_ids: list[int] | set[int] | None = None,
    ) -> dict[str, Any]:
        """
        Extracts common filter parameters from the request and returns them
        in a standard format.
        :param request:
        :param organization: Organization to get params for
        :param date_filter_optional: Defines what happens if no date filter
        :param project_ids: Project ids if they were already grabbed but not
        validated yet
        parameters are passed. If False, no date filtering occurs. If True, we
        provide default values.
        :return: A dict with keys:
         - start: start date of the filter
         - end: end date of the filter
         - project_id: A list of project ids to filter on
         - environment(optional): If environments were passed in, a list of
         environment names
        """
        # get the top level params -- projects, time range, and environment
        # from the request
        try:
            data = (
                request.data if len(request.GET) == 0 and hasattr(request, "data") else request.GET
            )
            # For some reason we use range in saved queries
            if "range" in data and "statsPeriod" not in data:
                data["statsPeriod"] = data["range"]
            start, end = get_date_range_from_params(data, optional=date_filter_optional)
            if start and end:
                total_seconds = (end - start).total_seconds()
                sentry_sdk.set_tag("query.period", total_seconds)
                one_day = 86400
                grouped_period = ">30d"
                if total_seconds <= one_day:
                    grouped_period = "<=1d"
                elif total_seconds <= one_day * 7:
                    grouped_period = "<=7d"
                elif total_seconds <= one_day * 14:
                    grouped_period = "<=14d"
                elif total_seconds <= one_day * 30:
                    grouped_period = "<=30d"
                sentry_sdk.set_tag("query.period.grouped", grouped_period)
        except InvalidParams as e:
            raise ParseError(detail=f"Invalid date range: {e}")

        try:
            if isinstance(project_ids, list):
                project_ids = set(project_ids)
            projects = self.get_projects(request, organization, project_ids=project_ids)
        except ValueError:
            raise ParseError(detail="Invalid project ids")

        if not projects:
            raise NoProjects

        len_projects = len(projects)
        sentry_sdk.set_tag("query.num_projects", len_projects)
        sentry_sdk.set_tag("query.num_projects.grouped", format_grouped_length(len_projects))
        set_measurement("query.num_projects", len_projects)

        params = {
            "start": start,
            "end": end,
            "project_id": [p.id for p in projects],
            "project_objects": projects,
            "organization_id": organization.id,
        }

        environments = self.get_environments(request, organization)
        if environments:
            params["environment"] = [env.name for env in environments]
            params["environment_objects"] = environments

        return params

    def convert_args(
        self, request: Request, organization_slug: str | None = None, *args: Any, **kwargs: Any
    ) -> tuple[tuple[Any, ...], dict[str, Any]]:
        if resolve_region(request) is None:
            subdomain = getattr(request, "subdomain", None)
            if subdomain is not None and subdomain != organization_slug:
                raise ResourceDoesNotExist

        if not organization_slug:
            raise ResourceDoesNotExist

        try:
            organization = Organization.objects.get_from_cache(slug=organization_slug)
        except Organization.DoesNotExist:
            raise ResourceDoesNotExist

        with sentry_sdk.start_span(
            op="check_object_permissions_on_organization", description=organization_slug
        ):
            self.check_object_permissions(request, organization)

        bind_organization_context(organization)

        request._request.organization = organization

        # Track the 'active' organization when the request came from
        # a cookie based agent (react app)
        # Never track any org (regardless of whether the user does or doesn't have
        # membership in that org) when the user is in active superuser mode
        if request.auth is None and request.user and not is_active_superuser(request):
            auth.set_active_org(request, organization.slug)

        kwargs["organization"] = organization
        return (args, kwargs)


class OrganizationReleasesBaseEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationReleasePermission,)

    def get_projects(  # type: ignore[override]
        self,
        request: Request,
        organization: Organization,
        project_ids: set[int] | None = None,
        include_all_accessible: bool = True,
    ) -> list[Project]:
        """
        Get all projects the current user or API token has access to. More
        detail in the parent class's method of the same name.
        """
        has_valid_api_key = False
        if isinstance(request.auth, ApiKey):
            if request.auth.organization_id != organization.id:
                return []
            has_valid_api_key = request.auth.has_scope(
                "project:releases"
            ) or request.auth.has_scope("project:write")

        if not (
            has_valid_api_key or (getattr(request, "user", None) and request.user.is_authenticated)
        ):
            return []

        return super().get_projects(
            request,
            organization,
            force_global_perms=has_valid_api_key,
            include_all_accessible=include_all_accessible,
            project_ids=project_ids,
        )

    def has_release_permission(
        self,
        request: Request,
        organization: Organization,
        release: Optional[Release] = None,
        project_ids: Optional[Set[int]] = None,
    ) -> bool:
        """
        Does the given request have permission to access this release, based
        on the projects to which the release is attached?

        If the given request has an actor (user or ApiKey), cache the results
        for a minute on the unique combination of actor,org,release, and project
        ids.
        """
        actor_id = None
        has_perms = None
        key = None
        if getattr(request, "user", None) and request.user.id:
            actor_id = "user:%s" % request.user.id
        if getattr(request, "auth", None) and request.auth.id:
            actor_id = "apikey:%s" % request.auth.id
        if actor_id is not None:
            requested_project_ids = project_ids
            if requested_project_ids is None:
                requested_project_ids = self.get_requested_project_ids_unchecked(request)
            key = "release_perms:1:%s" % hash_values(
                [actor_id, organization.id, release.id if release is not None else 0]
                + sorted(requested_project_ids)
            )
            has_perms = cache.get(key)
        if has_perms is None:
            projects = self.get_projects(request, organization, project_ids=project_ids)
            # XXX(iambriccardo): The logic here is that you have access to this release if any of your projects
            # associated with this release you have release permissions to.  This is a bit of
            # a problem because anyone can add projects to a release, so this check is easy
            # to defeat.
            if release is not None:
                has_perms = ReleaseProject.objects.filter(
                    release=release, project__in=projects
                ).exists()
            else:
                has_perms = len(projects) > 0

            if key is not None and actor_id is not None:
                cache.set(key, has_perms, 60)

        return has_perms
