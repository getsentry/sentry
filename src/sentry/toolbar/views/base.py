import logging
from typing import Any

from django.http import HttpRequest

from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.toolbar.utils.http import csp_add_directive
from sentry.web.frontend.base import OrganizationView

logger = logging.getLogger(__name__)


class ToolbarView(OrganizationView):
    def respond(self, template: str, context: dict[str, Any] | None = None, status: int = 200):
        response = super().respond(template, context=context, status=status)
        # Allow running the inline scripts in the response templates
        response["Content-Security-Policy"] = csp_add_directive(
            response.get("Content-Security-Policy", ""), "script-src", ["sentry.io", "*.sentry.io"]
        )
        logger.info(response["Content-Security-Policy"])
        return response

    def convert_args(self, request: HttpRequest, organization_slug: str, project_id_or_slug: int | str, *args: Any, **kwargs: Any) -> tuple[tuple[Any, ...], dict[str, Any]]:  # type: ignore[override]
        args, kwargs = super().convert_args(request, organization_slug, *args, **kwargs)
        organization: Organization | None = kwargs["organization"]
        active_project: Project | None = (
            self.get_active_project(
                request=request,
                organization=organization,  # type: ignore[arg-type]
                project_id_or_slug=project_id_or_slug,
            )
            if organization
            else None
        )
        kwargs["project"] = active_project
        return args, kwargs
