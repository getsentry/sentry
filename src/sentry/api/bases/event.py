from __future__ import annotations

from typing import Any

import sentry_sdk
from rest_framework.exceptions import NotFound
from rest_framework.permissions import BasePermission
from rest_framework.request import Request

from sentry.api.bases.project import ProjectEndpoint, ProjectEventPermission
from sentry.services import eventstore


class EventEndpoint(ProjectEndpoint):
    """
    Base endpoint for event-scoped operations.

    Automatically resolves the event from project context using the event_id URL parameter.
    Inherits from ProjectEndpoint to get automatic project resolution and permission checks.

    The resolved event is added to kwargs as 'event', making it available to all HTTP methods.

    Example URL pattern:
        /api/0/projects/{organization_id_or_slug}/{project_id_or_slug}/events/{event_id}/

    Usage:
        @region_silo_endpoint
        class MyEventEndpoint(EventEndpoint):
            owner = ApiOwner.ISSUES
            publish_status = {"GET": ApiPublishStatus.PRIVATE}

            def get(self, request: Request, project, event) -> Response:
                # project and event are already resolved and validated
                return Response({"event_id": event.event_id})
    """

    permission_classes: tuple[type[BasePermission], ...] = (ProjectEventPermission,)

    def convert_args(
        self,
        request: Request,
        *args: Any,
        **kwargs: Any,
    ) -> tuple[tuple[Any, ...], dict[str, Any]]:
        # First, resolve project from parent class (ProjectEndpoint)
        # This handles organization and project resolution, permission checks, and SDK tags
        args, kwargs = super().convert_args(request, *args, **kwargs)

        # Extract event_id from args or kwargs
        # URL pattern: /api/0/projects/{org}/{project}/events/{event_id}/
        if args and args[0] is not None:
            event_id: str = args[0]
            args = args[1:]  # Remove event_id from args
        else:
            event_id = kwargs.pop("event_id")

        # Fetch event from eventstore
        # project is guaranteed to exist at this point (resolved by parent)
        project = kwargs["project"]
        event = eventstore.backend.get_event_by_id(project.id, event_id)

        # Raise NotFound if event doesn't exist (DRF standard)
        if event is None:
            raise NotFound(detail="Event not found")

        # Set SDK tag for observability
        sentry_sdk.get_isolation_scope().set_tag("event", event.event_id)

        # Add resolved event to kwargs
        kwargs["event"] = event
        return (args, kwargs)
