from rest_framework.response import Response

from sentry import roles
from sentry.api.base import Endpoint
from sentry.api.exceptions import ProjectMoved, ResourceDoesNotExist
from sentry.api.helpers.environments import get_environments
from sentry.api.utils import InvalidParams, get_date_range_from_params
from sentry.auth.superuser import is_active_superuser
from sentry.auth.system import is_system_auth
from sentry.models import OrganizationMember, Project, ProjectRedirect, ProjectStatus, SentryApp
from sentry.utils.sdk import bind_organization_context, configure_scope

from .organization import OrganizationPermission
from .team import has_team_permission


class ProjectEventsError(Exception):
    pass


class ProjectPermission(OrganizationPermission):
    scope_map = {
        "GET": ["project:read", "project:write", "project:admin"],
        "POST": ["project:write", "project:admin"],
        "PUT": ["project:write", "project:admin"],
        "DELETE": ["project:admin"],
    }

    def has_object_permission(self, request, view, project):
        result = super().has_object_permission(request, view, project.organization)

        if not result:
            return result
        if project.teams.exists():
            return any(
                has_team_permission(request, team, self.scope_map) for team in project.teams.all()
            )
        elif is_system_auth(request.auth):
            return True
        elif request.user and request.user.is_authenticated:
            # this is only for team-less projects
            if is_active_superuser(request):
                return True
            elif request.user.is_sentry_app:
                return SentryApp.objects.check_project_permission_for_sentry_app_user(
                    request.user, project
                )
            try:
                role = (
                    OrganizationMember.objects.filter(
                        organization=project.organization, user=request.user
                    )
                    .values_list("role", flat=True)
                    .get()
                )
            except OrganizationMember.DoesNotExist:
                # this should probably never happen?
                return False

            return roles.get(role).is_global
        elif hasattr(request.auth, "project_id") and project.id == request.auth.project_id:
            return True

        return False


class StrictProjectPermission(ProjectPermission):
    scope_map = {
        "GET": ["project:write", "project:admin"],
        "POST": ["project:write", "project:admin"],
        "PUT": ["project:write", "project:admin"],
        "DELETE": ["project:admin"],
    }


class ProjectReleasePermission(ProjectPermission):
    scope_map = {
        "GET": ["project:read", "project:write", "project:admin", "project:releases"],
        "POST": ["project:write", "project:admin", "project:releases"],
        "PUT": ["project:write", "project:admin", "project:releases"],
        "DELETE": ["project:admin", "project:releases"],
    }


class ProjectEventPermission(ProjectPermission):
    scope_map = {
        "GET": ["event:read", "event:write", "event:admin"],
        "POST": ["event:write", "event:admin"],
        "PUT": ["event:write", "event:admin"],
        "DELETE": ["event:admin"],
    }


class ProjectSettingPermission(ProjectPermission):
    scope_map = {
        "GET": ["project:read", "project:write", "project:admin"],
        "POST": ["project:write", "project:admin"],
        "PUT": ["project:write", "project:admin"],
        "DELETE": ["project:write", "project:admin"],
    }


class RelaxedSearchPermission(ProjectPermission):
    scope_map = {
        "GET": ["project:read", "project:write", "project:admin"],
        # members can do writes
        "POST": ["project:write", "project:admin", "project:read"],
        "PUT": ["project:write", "project:admin", "project:read"],
        # members can delete their own searches
        "DELETE": ["project:read", "project:write", "project:admin"],
    }


class ProjectAlertRulePermission(ProjectPermission):
    scope_map = {
        "GET": ["project:read", "project:write", "project:admin", "alerts:read"],
        "POST": ["project:write", "project:admin", "alerts:write"],
        "PUT": ["project:write", "project:admin", "alerts:write"],
        "DELETE": ["project:write", "project:admin", "alerts:write"],
    }


class ProjectEndpoint(Endpoint):
    permission_classes = (ProjectPermission,)

    def convert_args(self, request, organization_slug, project_slug, *args, **kwargs):
        try:
            project = (
                Project.objects.filter(organization__slug=organization_slug, slug=project_slug)
                .select_related("organization")
                .prefetch_related("teams")
                .get()
            )
        except Project.DoesNotExist:
            try:
                # Project may have been renamed
                redirect = ProjectRedirect.objects.select_related("project")
                redirect = redirect.get(
                    organization__slug=organization_slug, redirect_slug=project_slug
                )
                # Without object permissions don't reveal the rename
                self.check_object_permissions(request, redirect.project)

                # get full path so that we keep query strings
                requested_url = request.get_full_path()
                new_url = requested_url.replace(
                    f"projects/{organization_slug}/{project_slug}/",
                    f"projects/{organization_slug}/{redirect.project.slug}/",
                )

                # Resource was moved/renamed if the requested url is different than the new url
                if requested_url != new_url:
                    raise ProjectMoved(new_url, redirect.project.slug)

                # otherwise project doesn't exist
                raise ResourceDoesNotExist
            except ProjectRedirect.DoesNotExist:
                raise ResourceDoesNotExist

        if project.status != ProjectStatus.VISIBLE:
            raise ResourceDoesNotExist

        self.check_object_permissions(request, project)

        with configure_scope() as scope:
            scope.set_tag("project", project.id)

        bind_organization_context(project.organization)

        request._request.organization = project.organization

        kwargs["project"] = project
        return (args, kwargs)

    def get_filter_params(self, request, project, date_filter_optional=False):
        """Similar to the version on the organization just for a single project."""
        # get the top level params -- projects, time range, and environment
        # from the request
        try:
            start, end = get_date_range_from_params(request.GET, optional=date_filter_optional)
        except InvalidParams as e:
            raise ProjectEventsError(str(e))

        environments = [env.name for env in get_environments(request, project.organization)]
        params = {"start": start, "end": end, "project_id": [project.id]}
        if environments:
            params["environment"] = environments

        return params

    def handle_exception(self, request, exc):
        if isinstance(exc, ProjectMoved):
            response = Response(
                {"slug": exc.detail["detail"]["extra"]["slug"], "detail": exc.detail["detail"]},
                status=exc.status_code,
            )
            response["Location"] = exc.detail["detail"]["extra"]["url"]
            return response
        return super().handle_exception(request, exc)
