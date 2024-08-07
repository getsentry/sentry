from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.serializers import serialize
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND, RESPONSE_UNAUTHORIZED
from sentry.apidocs.parameters import GlobalParams, UptimeParams
from sentry.models.project import Project
from sentry.uptime.endpoints.bases import ProjectUptimeAlertEndpoint
from sentry.uptime.endpoints.serializers import (
    ProjectUptimeSubscriptionSerializer,
    ProjectUptimeSubscriptionSerializerResponse,
)
from sentry.uptime.models import UptimeSubscription


@region_silo_endpoint
class ProjectUptimeAlertDetailsEndpoint(ProjectUptimeAlertEndpoint):
    owner = ApiOwner.CRONS

    # TODO(davidenwang): Flip these to public after EA
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }

    @extend_schema(
        operation_id="Retrieve an Uptime Alert Rule for a Project",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
            UptimeParams.UPTIME_ALERT_ID,
        ],
        responses={
            200: ProjectUptimeSubscriptionSerializer,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(
        self,
        request: Request,
        project: Project,
        uptime_subscription: UptimeSubscription,
    ) -> Response:
        serialized_uptime_alert: ProjectUptimeSubscriptionSerializerResponse = serialize(
            uptime_subscription,
            request.user,
        )
        return self.respond(serialized_uptime_alert)
