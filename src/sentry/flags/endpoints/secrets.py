from __future__ import annotations

from datetime import datetime, timezone
from typing import TypedDict

from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import Serializer, register, serialize
from sentry.flags.models import FlagWebHookSigningSecretModel
from sentry.models.organization import Organization

FlagWebhookSigningSecretResponse = TypedDict(
    {
        "createdAt": str,
        "createdBy": int,
        "id": int,
        "provider": str,
        "secret": str,
    }
)


@register(FlagWebHookSigningSecretModel)
class FlagWebhookSigningSecretSerializer(Serializer):
    def serialize(self, obj, attrs, user, **kwargs) -> FlagWebhookSigningSecretResponse:
        return {
            "createdAt": obj.date_added.timestamp(),
            "createdBy": obj.created_by,
            "id": obj.id,
            "provider": obj.provider,
            "secret": obj.secret,
        }


class FlagWebhookSigningSecretValidator(serializers.Serializer):
    provider = serializers.ChoiceField(choices=[("launchdarkly", "launchdarkly")], required=True)
    secret = serializers.CharField(required=True)


@region_silo_endpoint
class OrganizationFlagsWebHookSigningSecretEndpoint(OrganizationEndpoint):
    owner = ApiOwner.REPLAY
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "POST": ApiPublishStatus.PRIVATE,
    }

    def get(self, request: Request, organization: Organization) -> Response:
        return self.paginate(
            request=request,
            queryset=FlagWebHookSigningSecretModel.objects.filter(organization_id=organization.id),
            order_by="-date_added",
            on_results=lambda x: serialize(x, request.user, FlagWebhookSigningSecretSerializer()),
            paginator_cls=OffsetPaginator,
        )

    def post(self, request: Request, organization: Organization) -> Response:
        validator = FlagWebhookSigningSecretValidator(data=request.data)
        if not validator.is_valid():
            return self.respond(validator.errors, status=400)

        FlagWebHookSigningSecretModel.objects.create_or_update(
            organization=organization,
            provider=validator.validated_data["provider"],
            values={
                "created_by": request.user.id,
                "date_added": datetime.now(tz=timezone.utc),
                "provider": validator.validated_data["provider"],
                "secret": validator.validated_data["secret"],
            },
        )

        return Response(status=201)
