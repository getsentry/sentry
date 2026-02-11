from typing import Any

from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request

from sentry import features
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.incidents.models.incident import Incident
from sentry.workflow_engine.endpoints.utils.ids import to_valid_int_id


class IncidentPermission(OrganizationPermission):
    scope_map = {
        "GET": [
            "org:read",
            "org:write",
            "org:admin",
            "project:read",
            "project:write",
            "project:admin",
        ],
        "POST": ["org:write", "org:admin", "project:read", "project:write", "project:admin"],
        "PUT": ["org:write", "org:admin", "project:read", "project:write", "project:admin"],
        "DELETE": ["org:write", "org:admin", "project:read", "project:write", "project:admin"],
    }


class IncidentEndpoint(OrganizationEndpoint):
    def convert_args(
        self,
        request: Request,
        incident_identifier: str,
        *args: Any,
        **kwargs: Any,
    ) -> tuple[tuple[Any, ...], dict[str, Any]]:
        args, kwargs = super().convert_args(request, *args, **kwargs)
        organization = kwargs["organization"]

        if not features.has("organizations:incidents", organization, actor=request.user):
            raise ResourceDoesNotExist

        validated_incident_identifier = to_valid_int_id(
            "incident_identifier", incident_identifier, raise_404=True
        )

        try:
            incident = kwargs["incident"] = Incident.objects.get(
                organization=organization, identifier=validated_incident_identifier
            )
        except Incident.DoesNotExist:
            raise ResourceDoesNotExist

        if not any(
            project
            for project in incident.projects.all()
            if request.access.has_project_access(project)
        ):
            raise PermissionDenied

        return args, kwargs
