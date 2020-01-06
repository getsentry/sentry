from __future__ import absolute_import

from rest_framework.exceptions import PermissionDenied, ParseError

from django.core.cache import cache

from sentry.api.base import Endpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.helpers.environments import get_environments
from sentry.api.permissions import SentryPermission
from sentry.api.utils import get_date_range_from_params, InvalidParams
from sentry.auth.superuser import is_active_superuser
from sentry.constants import ALL_ACCESS_PROJECTS
from sentry.models import (
    ApiKey,
    Authenticator,
    Organization,
    Project,
    ProjectStatus,
    ReleaseProject,
)
from sentry.utils import auth
from sentry.utils.hashlib import hash_values
from sentry.utils.sdk import bind_organization_context


class OrganizationEventsError(Exception):
    pass


class NoProjects(Exception):
    pass


class OrganizationPermission(SentryPermission):
    scope_map = {
        "GET": ["org:read", "org:write", "org:admin"],
        "POST": ["org:write", "org:admin"],
        "PUT": ["org:write", "org:admin"],
        "DELETE": ["org:admin"],
    }

    def is_not_2fa_compliant(self, request, organization):
        return (
            organization.flags.require_2fa
            and not Authenticator.objects.user_has_2fa(request.user)
            and not is_active_superuser(request)
        )

    def needs_sso(self, request, organization):
        # XXX(dcramer): this is very similar to the server-rendered views
        # logic for checking valid SSO
        if not request.access.requires_sso:
            return False
        if not auth.has_completed_sso(request, organization.id):
            return True
        if not request.access.sso_is_valid:
            return True
        return False

    def has_object_permission(self, request, view, organization):
        self.determine_access(request, organization)
        allowed_scopes = set(self.scope_map.get(request.method, []))
        return any(request.access.has_scope(s) for s in allowed_scopes)


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


class OrganizationRepositoryPermission(OrganizationPermission):
    scope_map = {
        "GET": ["org:read", "org:write", "org:admin", "org:integrations"],
        "POST": ["org:write", "org:admin", "org:integrations"],
        "PUT": ["org:write", "org:admin"],
        "DELETE": ["org:admin"],
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
        "POST": ["org:write", "org:admin"],
        "PUT": ["org:write", "org:admin"],
        "DELETE": ["org:write", "org:admin"],
    }


class OrganizationEndpoint(Endpoint):
    permission_classes = (OrganizationPermission,)

    def get_projects(
        self, request, organization, force_global_perms=False, include_all_accessible=False
    ):
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
        :return: A list of Project objects, or raises PermissionDenied.
        """
        try:
            project_ids = set(map(int, request.GET.getlist("project")))
        except ValueError:
            raise ParseError(detail="Invalid project parameter. Values must be numbers.")
        return self._get_projects_by_id(
            project_ids, request, organization, force_global_perms, include_all_accessible
        )

    def _get_projects_by_id(
        self,
        project_ids,
        request,
        organization,
        force_global_perms=False,
        include_all_accessible=False,
    ):
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

        if force_global_perms:
            projects = list(qs)
        else:
            if (
                user
                and is_active_superuser(request)
                or requested_projects
                or include_all_accessible
            ):
                func = request.access.has_project_access
            else:
                func = request.access.has_project_membership
            projects = [p for p in qs if func(p)]

        project_ids = set(p.id for p in projects)

        if requested_projects and project_ids != requested_projects:
            raise PermissionDenied

        return projects

    def get_environments(self, request, organization):
        return get_environments(request, organization)

    def get_filter_params(self, request, organization, date_filter_optional=False):
        """
        Extracts common filter parameters from the request and returns them
        in a standard format.
        :param request:
        :param organization: Organization to get params for
        :param date_filter_optional: Defines what happens if no date filter
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
            start, end = get_date_range_from_params(request.GET, optional=date_filter_optional)
        except InvalidParams as exc:
            raise OrganizationEventsError(exc.message)

        try:
            projects = self.get_projects(request, organization)
        except ValueError:
            raise OrganizationEventsError("Invalid project ids")

        if not projects:
            raise NoProjects

        environments = [e.name for e in self.get_environments(request, organization)]
        params = {"start": start, "end": end, "project_id": [p.id for p in projects]}
        if environments:
            params["environment"] = environments

        return params

    def convert_args(self, request, organization_slug, *args, **kwargs):
        try:
            organization = Organization.objects.get_from_cache(slug=organization_slug)
        except Organization.DoesNotExist:
            raise ResourceDoesNotExist

        self.check_object_permissions(request, organization)

        bind_organization_context(organization)

        request._request.organization = organization

        # Track the 'active' organization when the request came from
        # a cookie based agent (react app)
        # Never track any org (regardless of whether the user does or doesn't have
        # membership in that org) when the user is in active superuser mode
        if request.auth is None and request.user and not is_active_superuser(request):
            request.session["activeorg"] = organization.slug

        kwargs["organization"] = organization
        return (args, kwargs)


class OrganizationReleasesBaseEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationReleasePermission,)

    def get_projects(self, request, organization):
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
            has_valid_api_key
            or (getattr(request, "user", None) and request.user.is_authenticated())
        ):
            return []

        return super(OrganizationReleasesBaseEndpoint, self).get_projects(
            request, organization, force_global_perms=has_valid_api_key, include_all_accessible=True
        )

    def has_release_permission(self, request, organization, release):
        """
        Does the given request have permission to access this release, based
        on the projects to which the release is attached?

        If the given request has an actor (user or ApiKey), cache the results
        for a minute on the unique combination of actor,org,release.
        """
        actor_id = None
        has_perms = None
        if getattr(request, "user", None) and request.user.id:
            actor_id = "user:%s" % request.user.id
        if getattr(request, "auth", None) and request.auth.id:
            actor_id = "apikey:%s" % request.auth.id
        if actor_id is not None:
            key = "release_perms:1:%s" % hash_values([actor_id, organization.id, release.id])
            has_perms = cache.get(key)
        if has_perms is None:
            has_perms = ReleaseProject.objects.filter(
                release=release, project__in=self.get_projects(request, organization)
            ).exists()
            if actor_id is not None:
                cache.set(key, has_perms, 60)

        return has_perms
