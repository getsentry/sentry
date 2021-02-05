from rest_framework.exceptions import PermissionDenied

from sentry import features
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.incidents.models import Incident


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
    def convert_args(self, request, incident_identifier, *args, **kwargs):
        args, kwargs = super().convert_args(request, *args, **kwargs)
        organization = kwargs["organization"]

        if not features.has("organizations:incidents", organization, actor=request.user):
            raise ResourceDoesNotExist

        if not incident_identifier.isdigit():
            raise ResourceDoesNotExist

        try:
            incident = kwargs["incident"] = Incident.objects.get(
                organization=organization, identifier=incident_identifier
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
