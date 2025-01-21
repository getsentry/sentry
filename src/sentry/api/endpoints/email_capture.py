from rest_framework import serializers
from rest_framework.response import Response

from sentry import options
from sentry.api.base import Endpoint, region_silo_endpoint
from sentry.api.permissions import SentryPermission
from sentry.api.serializers.rest_framework.base import CamelSnakeSerializer
from sentry.utils.marketo_client import MarketoClient

client = MarketoClient()


class EmailCaptureSerialier(CamelSnakeSerializer):
    email = serializers.EmailField(required=True)


@region_silo_endpoint
class EmailCaptureEndpoint(Endpoint):
    # Disable authentication and permission requirements.
    permission_classes = (SentryPermission,)

    def post(self, request):
        if not options.get("demo-mode.enabled"):
            return Response(status=404)

        serializer = EmailCaptureSerialier(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        email = serializer.validated_data["email"]

        # Include other fields in the request and send them to Marketo together.
        # There are a undetermined number of optional fields in request.data and we don't validate them.
        # Only the email field is required.
        form = request.data
        form["email"] = email
        client.submit_form(form)
        return Response(status=200)
