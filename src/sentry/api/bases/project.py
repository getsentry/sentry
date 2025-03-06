from __future__ import annotations

import http
from collections.abc import Mapping
from typing import Any

from rest_framework.permissions import BasePermission
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from sentry.api.base import Endpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.helpers.environments import get_environments
from sentry.api.permissions import StaffPermissionMixin
from sentry.api.utils import get_date_range_from_params
from sentry.constants import ObjectStatus
from sentry.exceptions import InvalidParams
from sentry.models.project import Project
from sentry.models.projectredirect import ProjectRedirect
from sentry.utils.sdk import Scope, bind_organization_context

from .organization import OrganizationPermission


class ProjectEventsError(Exception):
    pass


class ProjectMoved(Exception):
    def __init__(self, new_url: str, slug: str):
        self.new_url = new_url
        self.slug = slug
        super().__init__(new_url, slug)


class ProjectPermission(OrganizationPermission):
    scope_map = {
        "GET": ["project:read", "project:write", "project:admin"],
        "POST": ["project:write", "project:admin"],
        "PUT": ["project:write", "project:admin"],
        "DELETE": ["project:admin"],
    }

    def has_object_permission(self, request: Request, view: APIView, project: Project) -> bool:  # type: ignore[override]  # XXX: inheritance-for-convenience
        has_org_scope = super().has_object_permission(request, view, project.organization)

        # If allow_joinleave is False, some org-roles will not have project:read for all projects
        if has_org_scope and request.access.has_project_access(project):
            return has_org_scope

        assert request.method is not None
        allowed_scopes = set(self.scope_map.get(request.method, []))
        return request.access.has_any_project_scope(project, allowed_scopes)


class ProjectAndStaffPermission(StaffPermissionMixin, ProjectPermission):
    """Allows staff to access project endpoints."""

    pass


class StrictProjectPermission(ProjectPermission):
    scope_map = {
        "GET": ["project:write", "project:admin"],
        "POST": ["project:write", "project:admin"],
        "PUT": ["project:write", "project:admin"],
        "DELETE": ["project:admin"],
    }


class ProjectReleasePermission(ProjectPermission):
    scope_map = {
        "GET": ["project:read", "project:write", "project:admin", "project:releases", "org:ci"],
        "POST": ["project:write", "project:admin", "project:releases", "org:ci"],
        "PUT": ["project:write", "project:admin", "project:releases", "org:ci"],
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


class ProjectAlertRulePermission(ProjectPermission):
    scope_map = {
        "GET": ["project:read", "project:write", "project:admin", "alerts:read", "alerts:write"],
        "POST": ["project:write", "project:admin", "alerts:write"],
        "PUT": ["project:write", "project:admin", "alerts:write"],
        "DELETE": ["project:write", "project:admin", "alerts:write"],
    }


class ProjectOwnershipPermission(ProjectPermission):
    scope_map = {
        "GET": ["project:read", "project:write", "project:admin"],
        "POST": ["project:write", "project:admin"],
        "PUT": ["project:read", "project:write", "project:admin"],
        "DELETE": ["project:admin"],
    }


class ProjectEndpoint(Endpoint):
    permission_classes: tuple[type[BasePermission], ...] = (ProjectPermission,)

    def convert_args(
        self,
        request: Request,
        *args,
        **kwargs,
    ):
        if args and args[0] is not None:
            organization_id_or_slug: int | str = args[0]
            # Required so it behaves like the original convert_args, where organization_id_or_slug was another parameter
            # TODO: Remove this once we remove the old `organization_slug` parameter from getsentry
            args = args[1:]
        else:
            organization_id_or_slug = kwargs.pop("organization_id_or_slug", None) or kwargs.pop(
                "organization_slug"
            )

        if args and args[0] is not None:
            project_id_or_slug: int | str = args[0]
            # Required so it behaves like the original convert_args, where project_id_or_slug was another parameter
            args = args[1:]
        else:
            project_id_or_slug = kwargs.pop("project_id_or_slug", None) or kwargs.pop(
                "project_slug"
            )
        try:
            project = (
                Project.objects.filter(
                    organization__slug__id_or_slug=organization_id_or_slug,
                    slug__id_or_slug=project_id_or_slug,
                )
                .select_related("organization")
                .prefetch_related("teams")
                .get()
            )
        except Project.DoesNotExist:
            try:
                # Project may have been renamed
                # This will only happen if the passed in project_id_or_slug is a slug and not an id
                redirect = ProjectRedirect.objects.select_related("project").get(
                    organization__slug__id_or_slug=organization_id_or_slug,
                    redirect_slug=project_id_or_slug,
                )
                # Without object permissions don't reveal the rename
                self.check_object_permissions(request, redirect.project)

                # get full path so that we keep query strings
                requested_url = request.get_full_path()
                new_url = requested_url.replace(
                    f"projects/{organization_id_or_slug}/{project_id_or_slug}/",
                    f"projects/{organization_id_or_slug}/{redirect.project.slug}/",
                )

                # Resource was moved/renamed if the requested url is different than the new url
                if requested_url != new_url:
                    raise ProjectMoved(new_url, redirect.project.slug)

                # otherwise project doesn't exist
                raise ResourceDoesNotExist
            except ProjectRedirect.DoesNotExist:
                raise ResourceDoesNotExist

        if project.status != ObjectStatus.ACTIVE:
            raise ResourceDoesNotExist

        self.check_object_permissions(request, project)

        Scope.get_isolation_scope().set_tag("project", project.id)

        bind_organization_context(project.organization)

        request._request.organization = project.organization  # type: ignore[attr-defined]  # XXX: we should not be stuffing random attributes into HttpRequest

        kwargs["project"] = project
        return (args, kwargs)

    def get_filter_params(self, request: Request, project, date_filter_optional=False):
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

    def handle_exception_with_details(
        self,
        request: Request,
        exc: Exception,
        handler_context: Mapping[str, Any] | None = None,
        scope: Scope | None = None,
    ) -> Response:
        if isinstance(exc, ProjectMoved):
            response = Response(
                {"slug": exc.slug, "detail": {"extra": {"url": exc.new_url, "slug": exc.slug}}},
                status=http.HTTPStatus.FOUND.value,
            )
            response["Location"] = exc.new_url
            return response
        return super().handle_exception_with_details(request, exc, handler_context, scope)
