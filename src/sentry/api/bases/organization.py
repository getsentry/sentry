from __future__ import absolute_import

from rest_framework.exceptions import PermissionDenied

from sentry.api.base import Endpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.helpers.environments import get_environments
from sentry.api.permissions import SentryPermission
from sentry.api.utils import (
    get_date_range_from_params,
    InvalidParams,
)
from sentry.auth.superuser import is_active_superuser
from sentry.models import (
    ApiKey, Authenticator, Organization, OrganizationMemberTeam, Project,
    ProjectStatus, ReleaseProject,
)
from sentry.utils import auth
from sentry.utils.sdk import configure_scope


class OrganizationEventsError(Exception):
    pass


class NoProjects(Exception):
    pass


class OrganizationPermission(SentryPermission):
    scope_map = {
        'GET': ['org:read', 'org:write', 'org:admin'],
        'POST': ['org:write', 'org:admin'],
        'PUT': ['org:write', 'org:admin'],
        'DELETE': ['org:admin'],
    }

    def is_not_2fa_compliant(self, user, organization):
        return organization.flags.require_2fa and not Authenticator.objects.user_has_2fa(user)

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


# These are based on ProjectReleasePermission
# additional checks to limit actions to releases
# associated with projects people have access to
class OrganizationReleasePermission(OrganizationPermission):
    scope_map = {
        'GET': ['project:read', 'project:write', 'project:admin', 'project:releases'],
        'POST': ['project:write', 'project:admin', 'project:releases'],
        'PUT': ['project:write', 'project:admin', 'project:releases'],
        'DELETE': ['project:admin', 'project:releases'],
    }


class OrganizationIntegrationsPermission(OrganizationPermission):
    scope_map = {
        'GET': ['org:read', 'org:write', 'org:admin', 'org:integrations'],
        'POST': ['org:write', 'org:admin', 'org:integrations'],
        'PUT': ['org:write', 'org:admin', 'org:integrations'],
        'DELETE': ['org:admin', 'org:integrations'],
    }


class OrganizationAdminPermission(OrganizationPermission):
    scope_map = {
        'GET': ['org:admin'],
        'POST': ['org:admin'],
        'PUT': ['org:admin'],
        'DELETE': ['org:admin'],
    }


class OrganizationAuthProviderPermission(OrganizationPermission):
    scope_map = {
        'GET': ['org:read'],
        'POST': ['org:admin'],
        'PUT': ['org:admin'],
        'DELETE': ['org:admin'],
    }


class OrganizationDiscoverSavedQueryPermission(OrganizationPermission):
    # Relaxed permissions for saved queries in Discover
    scope_map = {
        'GET': ['org:read', 'org:write', 'org:admin'],
        'POST': ['org:read', 'org:write', 'org:admin'],
        'PUT': ['org:read', 'org:write', 'org:admin'],
        'DELETE': ['org:read', 'org:write', 'org:admin'],
    }


class OrganizationUserReportsPermission(OrganizationPermission):
    scope_map = {
        'GET': ['project:read', 'project:write', 'project:admin'],
    }


class OrganizationEndpoint(Endpoint):
    permission_classes = (OrganizationPermission, )

    def get_projects(
        self,
        request,
        organization,
        force_global_perms=False,
        include_allow_joinleave=False,
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
        :param include_allow_joinleave: Whether to factor the organization
        allow_joinleave flag into permission checks. We should ideally
        standardize how this is used and remove this parameter.
        :return: A list of project ids, or raises PermissionDenied.
        """
        project_ids = set(map(int, request.GET.getlist('project')))

        requested_projects = project_ids.copy()

        user = getattr(request, 'user', None)

        if (
            user and is_active_superuser(request)
            or include_allow_joinleave and organization.flags.allow_joinleave
            or force_global_perms
        ):
            qs = Project.objects.filter(
                organization=organization,
                status=ProjectStatus.VISIBLE,
            )
        else:
            qs = Project.objects.filter(
                organization=organization,
                teams__in=OrganizationMemberTeam.objects.filter(
                    organizationmember__user=user,
                    organizationmember__organization=organization,
                ).values_list('team'),
                status=ProjectStatus.VISIBLE,
            )

        if project_ids:
            qs = qs.filter(id__in=project_ids)

        projects = list(qs)
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
            start, end = get_date_range_from_params(
                request.GET,
                optional=date_filter_optional,
            )
        except InvalidParams as exc:
            raise OrganizationEventsError(exc.message)

        try:
            projects = self.get_projects(request, organization)
        except ValueError:
            raise OrganizationEventsError('Invalid project ids')

        if not projects:
            raise NoProjects

        environments = [e.name for e in self.get_environments(request, organization)]
        params = {
            'start': start,
            'end': end,
            'project_id': [p.id for p in projects],
        }
        if environments:
            params['environment'] = environments

        return params

    def convert_args(self, request, organization_slug, *args, **kwargs):
        try:
            organization = Organization.objects.get_from_cache(
                slug=organization_slug,
            )
        except Organization.DoesNotExist:
            raise ResourceDoesNotExist

        self.check_object_permissions(request, organization)

        with configure_scope() as scope:
            scope.set_tag("organization", organization.id)

        request._request.organization = organization

        # Track the 'active' organization when the request came from
        # a cookie based agent (react app)
        if request.auth is None and request.user:
            request.session['activeorg'] = organization.slug

        kwargs['organization'] = organization
        return (args, kwargs)


class OrganizationReleasesBaseEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationReleasePermission, )

    def get_projects(self, request, organization):
        has_valid_api_key = False
        if isinstance(request.auth, ApiKey):
            if request.auth.organization_id != organization.id:
                return []
            has_valid_api_key = request.auth.has_scope('project:releases') or \
                request.auth.has_scope('project:write')

        if not (
            has_valid_api_key
            or getattr(request, 'user', None) and request.user.is_authenticated()
        ):
            return []

        return super(OrganizationReleasesBaseEndpoint, self).get_projects(
            request,
            organization,
            force_global_perms=has_valid_api_key,
            include_allow_joinleave=True,
        )

    def has_release_permission(self, request, organization, release):
        return ReleaseProject.objects.filter(
            release=release,
            project__in=self.get_projects(request, organization),
        ).exists()
