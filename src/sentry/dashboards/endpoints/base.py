from __future__ import annotations

from typing import Any, Protocol

from rest_framework.request import Request

from sentry.models.organization import Organization
from sentry.models.project import Project


class _ResolvesProjects(Protocol):
    """The slice of `OrganizationEndpoint` the context builder needs."""

    def get_projects(
        self,
        request: Request,
        organization: Organization,
        *,
        include_all_accessible: bool = ...,
    ) -> list[Project]: ...


class DashboardSerializerContextMixin:
    """Builds the serializer context shared by the dashboard write endpoints."""

    def get_dashboard_serializer_context(
        self: _ResolvesProjects,
        request: Request,
        organization: Organization,
        **extra: Any,
    ) -> dict[str, Any]:
        """Context with separate project lists for writes and for validation.

        `projects` gates what the requester may save (see
        `DashboardDetailsSerializer.validate_projects`) and stays filtered by
        team membership. `validation_projects` only feeds the query builder, so
        it may use `include_all_accessible` — otherwise a teamless member of an
        `allow_joinleave` org resolves to nothing despite seeing every project.
        Resolved only when the membership list is empty, and truncated because
        which projects are in scope doesn't change what validation decides.
        """
        projects = self.get_projects(request, organization)
        return {
            "organization": organization,
            "request": request,
            "projects": projects,
            "validation_projects": projects
            or self.get_projects(request, organization, include_all_accessible=True)[:1],
            **extra,
        }
