from datetime import datetime, timezone

from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.flags.endpoints import OrganizationFlagsEndpoint
from sentry.flags.models import FlagWebHookSigningSecretModel
from sentry.models.organization import Organization


class FlagWebhookSigningSecretValidator(serializers.Serializer):
    secret = serializers.CharField(required=True)


@region_silo_endpoint
class OrganizationFlagsWebHookSigningSecretEndpoint(OrganizationFlagsEndpoint):
    authentication_classes = ()
    owner = ApiOwner.REPLAY
    permission_classes = ()
    publish_status = {"POST": ApiPublishStatus.PRIVATE}

    def post(self, request: Request, organization: Organization, provider: str) -> Response:
        if not features.has(
            "organizations:feature-flag-audit-log", organization, actor=request.user
        ):
            return Response("Not enabled.", status=404)

        validator = FlagWebhookSigningSecretValidator(data=request.data)
        if not validator.is_valid():
            return self.respond(validator.errors, status=400)

        FlagWebHookSigningSecretModel.objects.create_or_update(
            organization=organization,
            provider=provider,
            values={
                "created_by": request.user.id,
                "date_added": datetime.now(tz=timezone.utc),
                "secret": validator.validated_data["secret"],
            },
        )

        return Response(status=201)
