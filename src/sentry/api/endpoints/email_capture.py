from rest_framework import serializers
from rest_framework.permissions import IsAuthenticated  # noqa S012
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, region_silo_endpoint
from sentry.api.serializers.rest_framework.base import CamelSnakeSerializer
from sentry.utils.demo_mode import is_demo_mode_enabled
from sentry.utils.marketo_client import MarketoClient

client = MarketoClient()


class EmailCaptureSerializer(CamelSnakeSerializer):
    email = serializers.EmailField(required=True)


@region_silo_endpoint
class EmailCaptureEndpoint(Endpoint):
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.TELEMETRY_EXPERIENCE
    # Disable authentication and permission requirements.
    permission_classes = (IsAuthenticated,)

    def post(self, request: Request) -> Response:
        if not is_demo_mode_enabled():
            return Response(status=404)

        serializer = EmailCaptureSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data["email"]

        # Include other fields in the request and send them to Marketo together.
        # There are a undetermined number of optional fields in request.data and we don't validate them.
        # Only the email field is required.
        form = request.data
        form["email"] = email
        client.submit_form(form)
        return Response(status=200)
