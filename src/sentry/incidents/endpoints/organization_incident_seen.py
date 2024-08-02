from django.utils import timezone as django_timezone
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.incident import IncidentEndpoint, IncidentPermission
from sentry.incidents.models.incident import Incident, IncidentProject, IncidentSeen
from sentry.users.services.user import RpcUser
from sentry.users.services.user.serial import serialize_generic_user


@region_silo_endpoint
class OrganizationIncidentSeenEndpoint(IncidentEndpoint):
    owner = ApiOwner.ISSUES
    publish_status = {
        "POST": ApiPublishStatus.UNKNOWN,
    }
    permission_classes = (IncidentPermission,)

    def post(self, request: Request, organization, incident) -> Response:
        """
        Mark an incident as seen by the user
        ````````````````````````````````````

        :auth: required
        """

        set_incident_seen(incident=incident, user=serialize_generic_user(request.user))
        return Response({}, status=201)


def set_incident_seen(incident: Incident, user: RpcUser | None = None) -> bool:
    """
    Updates the incident to be seen
    """

    is_org_member = incident.organization.has_access(user)

    if is_org_member:
        is_project_member = False
        for incident_project in IncidentProject.objects.filter(incident=incident).select_related(
            "project"
        ):
            if incident_project.project.member_set.filter(
                user_id=user.id if user else None
            ).exists():
                is_project_member = True
                break

        if is_project_member:
            incident_seen, created = IncidentSeen.objects.create_or_update(
                incident=incident,
                user_id=user.id if user else None,
                values={"last_seen": django_timezone.now()},
            )
            return incident_seen

    return False
