from typing import Any

from django.db.models import F
from rest_framework.request import Request

from sentry.api.bases.project import ProjectEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.models.projectkey import ProjectKey


class ProjectKeyEndpoint(ProjectEndpoint):
    """
    Base endpoint for ProjectKey resources.

    Automatically fetches and validates the ProjectKey based on the key_id URL parameter.
    Subclasses receive the key as a parameter in their HTTP methods.
    """

    def convert_args(
        self, request: Request, key_id: str, *args: Any, **kwargs: Any
    ) -> tuple[tuple[Any, ...], dict[str, Any]]:
        args, kwargs = super().convert_args(request, *args, **kwargs)
        project = kwargs["project"]
        try:
            kwargs["key"] = ProjectKey.objects.for_request(request).get(
                project=project, public_key=key_id, roles=F("roles").bitor(ProjectKey.roles.store)
            )
        except ProjectKey.DoesNotExist:
            raise ResourceDoesNotExist

        return (args, kwargs)
