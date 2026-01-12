from typing import Any

from rest_framework.request import Request

from sentry.api.bases.project import ProjectEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.sentry_apps.models.servicehook import ServiceHook


class ServiceHookEndpoint(ProjectEndpoint):
    """
    Base endpoint for ServiceHook resources.

    Automatically fetches and validates the ServiceHook based on the hook_id URL parameter.
    Subclasses receive the hook as a parameter in their HTTP methods.
    """

    def convert_args(
        self, request: Request, hook_id: str, *args: Any, **kwargs: Any
    ) -> tuple[tuple[Any, ...], dict[str, Any]]:
        args, kwargs = super().convert_args(request, *args, **kwargs)
        project = kwargs["project"]
        try:
            kwargs["hook"] = ServiceHook.objects.get(project_id=project.id, guid=hook_id)
        except ServiceHook.DoesNotExist:
            raise ResourceDoesNotExist

        return (args, kwargs)
