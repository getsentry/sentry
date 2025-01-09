from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime
from typing import Any, TypedDict

import sentry_sdk
from django.core.cache import cache
from django.http.request import HttpRequest
from rest_framework.exceptions import ParseError, PermissionDenied
from rest_framework.permissions import BasePermission
from rest_framework.request import Request

from sentry.api.base import Endpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.helpers.environments import get_environments
from sentry.api.permissions import SentryPermission, StaffPermissionMixin
from sentry.api.utils import get_date_range_from_params, is_member_disabled_from_limit
from sentry.auth.staff import is_active_staff
from sentry.auth.superuser import is_active_superuser
from sentry.constants import ALL_ACCESS_PROJECT_ID, ALL_ACCESS_PROJECTS_SLUG, ObjectStatus
from sentry.exceptions import InvalidParams
from sentry.models.apikey import is_api_key_auth
from sentry.models.environment import Environment
from sentry.models.organization import Organization
from sentry.models.orgauthtoken import is_org_auth_token_auth
from sentry.models.project import Project
from sentry.models.release import Release
from sentry.models.releases.release_project import ReleaseProject
from sentry.organizations.services.organization import (
    RpcOrganization,
    RpcUserOrganizationContext,
    organization_service,
)
from sentry.types.region import subdomain_is_region
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

    def is_not_2fa_compliant(
        self, request: Request, organization: RpcOrganization | Organization
    ) -> bool:
        if not organization.flags.require_2fa:
            return False

        if request.user.has_2fa():  # type: ignore[union-attr]
            return False

        if is_active_superuser(request):
            return False

        return True

    def needs_sso(self, request: Request, organization: Organization | RpcOrganization) -> bool:
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
        self,
        request: Request,
        view: object,
        organization: Organization | RpcOrganization | RpcUserOrganizationContext,
    ) -> bool:
        self.determine_access(request, organization)
        allowed_scopes = set(self.scope_map.get(request.method or "", []))
        return any(request.access.has_scope(s) for s in allowed_scopes)

    def is_member_disabled_from_limit(
        self,
        request: Request,
        organization: Organization | RpcOrganization | RpcUserOrganizationContext,
    ) -> bool:
        return is_member_disabled_from_limit(request, organization)


class OrganizationAndStaffPermission(StaffPermissionMixin, OrganizationPermission):
    """Allows staff to to access organization endpoints."""

    pass


class OrganizationAuditPermission(OrganizationPermission):
    scope_map = {"GET": ["org:write"]}

    def has_object_permission(
        self,
        request: Request,
        view: object,
        organization: Organization | RpcOrganization | RpcUserOrganizationContext,
    ) -> bool:
        if super().has_object_permission(request, view, organization):
            return True

        # the GET requires org:write, but we want both superuser read-only +
        # write to be able to access this GET. read-only only has :read scopes
        return is_active_superuser(request)


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
        "GET": ["project:read", "project:write", "project:admin", "project:releases", "org:ci"],
        "POST": ["project:write", "project:admin", "project:releases", "org:ci"],
        "PUT": ["project:write", "project:admin", "project:releases", "org:ci"],
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
        "GET": ["org:read", "org:write", "org:admin", "org:integrations", "org:ci"],
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
        "GET": ["org:read", "org:write", "org:admin", "alerts:read"],
        # grant org:read permission, but raise permission denied if the members aren't allowed
        # to create alerts and the user isn't a team admin
        "POST": ["org:read", "org:write", "org:admin", "alerts:write"],
        "PUT": ["org:write", "org:admin", "alerts:write"],
        "DELETE": ["org:write", "org:admin", "alerts:write"],
    }


class OrgAuthTokenPermission(OrganizationPermission):
    scope_map = {
        "GET": ["org:read", "org:write", "org:admin"],
        "POST": ["org:read", "org:write", "org:admin"],
        "PUT": ["org:read", "org:write", "org:admin"],
        "DELETE": ["org:write", "org:admin"],
    }


class OrganizationMetricsPermission(OrganizationPermission):
    scope_map = {
        "GET": ["org:read", "org:write", "org:admin"],
        "POST": ["org:read", "org:write", "org:admin"],
        "PUT": ["org:write", "org:admin"],
        "DELETE": ["org:admin"],
    }


class OrganizationFlagWebHookSigningSecretPermission(OrganizationPermission):
    scope_map = {
        "GET": ["org:read", "org:write", "org:admin"],
        "POST": ["org:read", "org:write", "org:admin"],
        "DELETE": ["org:write", "org:admin"],
    }


class ControlSiloOrganizationEndpoint(Endpoint):
    """
    A base class for endpoints that use an organization scoping but lives in the control silo
    """

    permission_classes: tuple[type[BasePermission], ...] = (OrganizationPermission,)

    def convert_args(
        self,
        request: Request,
        *args: Any,
        **kwargs: Any,
    ) -> tuple[tuple[Any, ...], dict[str, Any]]:
        organization_id_or_slug: int | str | None = None
        if args and args[0] is not None:
            organization_id_or_slug = args[0]
            # Required so it behaves like the original convert_args, where organization_id_or_slug was another parameter
            # TODO: Remove this once we remove the old `organization_slug` parameter from getsentry
            args = args[1:]
        else:
            organization_id_or_slug = kwargs.pop("organization_id_or_slug", None) or kwargs.pop(
                "organization_slug", None
            )

        if not organization_id_or_slug:
            raise ResourceDoesNotExist

        if not subdomain_is_region(request):
            subdomain = getattr(request, "subdomain", None)
            if subdomain is not None and subdomain != organization_id_or_slug:
                raise ResourceDoesNotExist

        if str(organization_id_or_slug).isdecimal():
            # It is ok that `get_organization_by_id` doesn't check for visibility as we
            # don't check the visibility in `get_organization_by_slug` either (only_active=False).
            organization_context = organization_service.get_organization_by_id(
                id=int(organization_id_or_slug), user_id=request.user.id
            )
        else:
            organization_context = organization_service.get_organization_by_slug(
                slug=str(organization_id_or_slug), only_visible=False, user_id=request.user.id
            )
        if organization_context is None:
            raise ResourceDoesNotExist

        with sentry_sdk.start_span(op="check_object_permissions_on_organization"):
            self.check_object_permissions(request, organization_context)

        bind_organization_context(organization_context.organization)

        # Track the 'active' organization when the request came from
        # a cookie based agent (react app)
        # Never track any org (regardless of whether the user does or doesn't have
        # membership in that org) when the user is in active superuser mode
        if request.auth is None and request.user and not is_active_superuser(request):
            auth.set_active_org(request, organization_context.organization.slug)

        kwargs["organization_context"] = organization_context
        kwargs["organization"] = organization_context.organization

        # Used for API access logs
        request._request.organization = organization_context.organization  # type: ignore[attr-defined]

        return (args, kwargs)


class FilterParams(TypedDict, total=False):
    start: datetime | None
    end: datetime | None
    project_id: list[int]
    project_objects: list[Project]
    organization_id: int
    environment: list[str] | None
    environment_objects: list[Environment] | None


def _validate_fetched_projects(
    filtered_projects: Sequence[Project],
    slugs: set[str] | None,
    ids: set[int] | None,
) -> None:
    """
    Validates that user has access to the specific projects they are requesting.
    """
    missing_project_ids = ids and ids != {p.id for p in filtered_projects}
    missing_project_slugs = slugs and slugs != {p.slug for p in filtered_projects}

    if missing_project_ids or missing_project_slugs:
        raise PermissionDenied


class OrganizationEndpoint(Endpoint):
    permission_classes: tuple[type[BasePermission], ...] = (OrganizationPermission,)

    def get_projects(
        self,
        request: HttpRequest,
        organization: Organization | RpcOrganization,
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
        :param force_global_perms: Permission override. Allows subclasses to perform their own validation
        and allow the user to access any project in the organization. This is a hack to support the old
        `request.auth.has_scope` way of checking permissions, don't use it for anything else, we plan to
        remove this once we remove uses of `auth.has_scope`.
        :param include_all_accessible: Whether to factor the organization allow_joinleave flag into
        permission checks. We should ideally standardize how this is used and remove this parameter.
        :param project_ids: Projects if they were passed via request data instead of get params
        :param project_slugs: Project slugs if they were passed via request  data instead of get params
        :return: A list of Project objects, or raises PermissionDenied.

        NOTE: If both project_ids and project_slugs are passed, we will default
        to fetching projects via project_id list.
        """
        qs = Project.objects.filter(organization=organization, status=ObjectStatus.ACTIVE)
        if project_slugs and project_ids:
            raise ParseError(detail="Cannot query for both ids and slugs")

        slugs = project_slugs or set(filter(None, request.GET.getlist("projectSlug")))
        ids = project_ids or self.get_requested_project_ids_unchecked(request)

        if project_ids is None and slugs:
            # If we're querying for project slugs specifically
            if ALL_ACCESS_PROJECTS_SLUG in slugs:
                # All projects I have access to
                include_all_accessible = True
            else:
                qs = qs.filter(slug__in=slugs)
        else:
            # If we are explicitly querying for projects via id
            # Or we're querying for an empty set of ids
            if ALL_ACCESS_PROJECT_ID in ids:
                # All projects i have access to
                include_all_accessible = True
            elif ids:
                qs = qs.filter(id__in=ids)
            # No project ids === `all projects I am a member of`

        with sentry_sdk.start_span(op="fetch_organization_projects") as span:
            projects = list(qs)
            span.set_data("Project Count", len(projects))

        filter_by_membership = not bool(ids) and not bool(slugs)
        filtered_projects = self._filter_projects_by_permissions(
            projects=projects,
            request=request,
            filter_by_membership=filter_by_membership,
            force_global_perms=force_global_perms,
            include_all_accessible=include_all_accessible,
        )

        requesting_specific_projects = not include_all_accessible and not filter_by_membership
        if requesting_specific_projects:
            _validate_fetched_projects(filtered_projects, slugs, ids)

        return filtered_projects

    def _filter_projects_by_permissions(
        self,
        projects: list[Project],
        request: HttpRequest,
        filter_by_membership: bool = False,
        force_global_perms: bool = False,
        include_all_accessible: bool = False,
    ) -> list[Project]:
        with sentry_sdk.start_span(op="apply_project_permissions") as span:
            span.set_data("Project Count", len(projects))
            if force_global_perms:
                span.set_tag("mode", "force_global_perms")
                return projects

            # There is a special case for staff, where we want to fetch a single project (OrganizationStatsEndpointV2)
            # or all projects (OrganizationMetricsDetailsEndpoint) in _admin. Staff cannot use has_project_access
            # like superuser because it fails due to staff having no scopes. The workaround is to create a lambda that
            # mimics checking for active projects like has_project_access without further validation.
            # NOTE: We must check staff before superuser or else _admin will fail when both cookies are active
            if is_active_staff(request):
                span.set_tag("mode", "staff_fetch_all")
                proj_filter = lambda proj: proj.status == ObjectStatus.ACTIVE  # noqa: E731
            # Superuser should fetch all projects.
            # Also fetch all accessible projects if requesting $all
            elif is_active_superuser(request) or include_all_accessible:
                span.set_tag("mode", "has_project_access")
                proj_filter = request.access.has_project_access
            # Check if explicitly requesting specific projects
            elif not filter_by_membership:
                span.set_tag("mode", "has_project_access")
                proj_filter = request.access.has_project_access
            else:
                span.set_tag("mode", "has_project_membership")
                proj_filter = request.access.has_project_membership

            return [p for p in projects if proj_filter(p)]

    def get_requested_project_ids_unchecked(self, request: Request | HttpRequest) -> set[int]:
        """
        Returns the project ids that were requested by the request.

        To determine the projects to filter this endpoint by with full
        permission checking, use ``get_projects``, instead.
        """
        try:
            return set(map(int, request.GET.getlist("project")))
        except ValueError:
            raise ParseError(detail="Invalid project parameter. Values must be numbers.")

    def get_environments(
        self, request: Request, organization: Organization | RpcOrganization
    ) -> list[Environment]:
        return get_environments(request, organization)

    def get_filter_params(
        self,
        request: Request,
        organization: Organization | RpcOrganization,
        date_filter_optional: bool = False,
        project_ids: list[int] | set[int] | None = None,
        project_slugs: list[str] | set[str] | None = None,
    ) -> FilterParams:
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
            if isinstance(project_slugs, list):
                project_slugs = set(project_slugs)
            projects = self.get_projects(
                request, organization, project_ids=project_ids, project_slugs=project_slugs
            )
        except ValueError:
            raise ParseError(detail="Invalid project ids")

        if not projects:
            raise NoProjects

        len_projects = len(projects)
        sentry_sdk.set_tag("query.num_projects", len_projects)
        sentry_sdk.set_tag("query.num_projects.grouped", format_grouped_length(len_projects))
        set_measurement("query.num_projects", len_projects)

        params: FilterParams = {
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
        self,
        request: Request,
        *args: Any,
        **kwargs: Any,
    ) -> tuple[tuple[Any, ...], dict[str, Any]]:
        """
        We temporarily allow the organization_id_or_slug to be an integer as it actually can be both slug or id
        Eventually, we will rename this method to organization_id_or_slug
        """
        organization_id_or_slug: int | str | None = None
        if args and args[0] is not None:
            organization_id_or_slug = args[0]
            # Required so it behaves like the original convert_args, where organization_id_or_slug was another parameter
            # TODO: Remove this once we remove the old `organization_slug` parameter from getsentry
            args = args[1:]
        else:
            organization_id_or_slug = kwargs.pop("organization_id_or_slug", None) or kwargs.pop(
                "organization_slug", None
            )

        if not organization_id_or_slug:
            raise ResourceDoesNotExist

        if not subdomain_is_region(request):
            subdomain = getattr(request, "subdomain", None)
            if subdomain is not None and subdomain != organization_id_or_slug:
                raise ResourceDoesNotExist

        try:
            if str(organization_id_or_slug).isdecimal():
                organization = Organization.objects.get_from_cache(id=organization_id_or_slug)
            else:
                organization = Organization.objects.get_from_cache(slug=organization_id_or_slug)
        except Organization.DoesNotExist:
            raise ResourceDoesNotExist

        with sentry_sdk.start_span(op="check_object_permissions_on_organization"):
            self.check_object_permissions(request, organization)

        bind_organization_context(organization)

        request._request.organization = organization  # type: ignore[attr-defined]

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
        organization: Organization | RpcOrganization,
        project_ids: set[int] | None = None,
        project_slugs: set[str] | None = None,
        include_all_accessible: bool = True,
    ) -> list[Project]:
        """
        Get all projects the current user or API token has access to. More
        detail in the parent class's method of the same name.
        """
        has_valid_api_key = False
        if is_api_key_auth(request.auth):
            if request.auth.organization_id != organization.id:
                return []
            has_valid_api_key = request.auth.has_scope(
                "project:releases"
            ) or request.auth.has_scope("project:write")

        if is_org_auth_token_auth(request.auth):
            if request.auth.organization_id != organization.id:
                return []
            has_valid_api_key = request.auth.has_scope("org:ci")

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
            project_slugs=project_slugs,
        )

    def has_release_permission(
        self,
        request: Request,
        organization: Organization | RpcOrganization,
        release: Release | None = None,
        project_ids: set[int] | None = None,
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
        if getattr(request, "auth", None) and getattr(request.auth, "id", None):
            actor_id = "apikey:%s" % request.auth.id  # type: ignore[union-attr]
        elif getattr(request, "auth", None) and getattr(request.auth, "entity_id", None):
            actor_id = "apikey:%s" % request.auth.entity_id  # type: ignore[union-attr]
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
