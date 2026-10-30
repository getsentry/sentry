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
    Subclasses receive the project_key as a parameter in their HTTP methods.
    """

    def convert_args(
        self, request: Request, key_id: str, *args: Any, **kwargs: Any
    ) -> tuple[tuple[Any, ...], dict[str, Any]]:
        args, kwargs = super().convert_args(request, *args, **kwargs)
        project = kwargs["project"]
        try:
            project_key = ProjectKey.objects.for_request(request).get(
                project=project, public_key=key_id, roles=F("roles").bitor(ProjectKey.roles.store)
            )
        except ProjectKey.DoesNotExist:
            raise ResourceDoesNotExist

        # The key was looked up by `project`, which already has its organization loaded.
        # Reuse it so serializing the key's DSNs doesn't load both again.
        project_key.set_cached_field_value("project", project)
        kwargs["project_key"] = project_key

        return (args, kwargs)
