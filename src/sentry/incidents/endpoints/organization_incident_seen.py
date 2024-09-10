from django.utils import timezone as django_timezone
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.incident import IncidentEndpoint, IncidentPermission
from sentry.incidents.models.incident import Incident, IncidentProject, IncidentSeen
from sentry.models.organization import Organization
from sentry.users.services.user import RpcUser
from sentry.users.services.user.serial import serialize_generic_user


@region_silo_endpoint
class OrganizationIncidentSeenEndpoint(IncidentEndpoint):
    owner = ApiOwner.ISSUES
    publish_status = {
        "POST": ApiPublishStatus.UNKNOWN,
    }
    permission_classes = (IncidentPermission,)

    def post(self, request: Request, organization: Organization, incident: Incident) -> Response:
        """
        Mark an incident as seen by the user
        ````````````````````````````````````

        :auth: required
        """

        user = serialize_generic_user(request.user)
        if user is not None:
            _set_incident_seen(incident, user)
        return Response({}, status=201)


def _set_incident_seen(incident: Incident, user: RpcUser) -> None:
    """
    Updates the incident to be seen
    """

    def is_project_member() -> bool:
        incident_projects = IncidentProject.objects.filter(incident=incident)
        for incident_project in incident_projects.select_related("project"):
            if incident_project.project.member_set.filter(user_id=user.id).exists():
                return True
        return False

    is_org_member = incident.organization.has_access(user)
    if is_org_member and is_project_member():
        IncidentSeen.objects.create_or_update(
            incident=incident, user_id=user.id, values={"last_seen": django_timezone.now()}
        )
