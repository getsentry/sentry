from __future__ import annotations

from datetime import datetime, timezone
from typing import TypedDict

from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import (
    OrganizationEndpoint,
    OrganizationFlagWebHookSigningSecretPermission,
)
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import Serializer, register, serialize
from sentry.flags.models import FlagWebHookSigningSecretModel, ProviderEnum
from sentry.models.organization import Organization


class FlagWebhookSigningSecretResponse(TypedDict):
    createdAt: str
    createdBy: int
    id: int
    provider: str
    secret: str


@register(FlagWebHookSigningSecretModel)
class FlagWebhookSigningSecretSerializer(Serializer):
    def serialize(self, obj, attrs, user, **kwargs) -> FlagWebhookSigningSecretResponse:
        return {
            "createdAt": obj.date_added.isoformat(),
            "createdBy": obj.created_by,
            "id": obj.id,
            "provider": obj.provider,
            "secret": obj.secret[0:6] + "*" * (len(obj.secret) - 6),
        }


class FlagWebhookSigningSecretValidator(serializers.Serializer):
    provider = serializers.ChoiceField(choices=ProviderEnum.get_names(), required=True)
    secret = serializers.CharField(required=True)

    def validate_secret(self, value):
        if self.initial_data.get("provider") == "statsig":
            if not value.startswith("webhook-"):
                raise serializers.ValidationError(
                    "Ensure this field is of the format webhook-<hash>"
                )
            return serializers.CharField(min_length=32, max_length=64).run_validation(value)

        return serializers.CharField(min_length=32, max_length=32).run_validation(value)


@region_silo_endpoint
class OrganizationFlagsWebHookSigningSecretsEndpoint(OrganizationEndpoint):
    owner = ApiOwner.REPLAY
    permission_classes = (OrganizationFlagWebHookSigningSecretPermission,)
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "POST": ApiPublishStatus.PRIVATE,
    }

    def get(self, request: Request, organization: Organization) -> Response:
        if not features.has(
            "organizations:feature-flag-audit-log", organization, actor=request.user
        ):
            return Response("Not enabled.", status=404)

        return self.paginate(
            request=request,
            queryset=FlagWebHookSigningSecretModel.objects.filter(organization_id=organization.id),
            order_by="-date_added",
            on_results=lambda x: {
                "data": serialize(x, request.user, FlagWebhookSigningSecretSerializer())
            },
            paginator_cls=OffsetPaginator,
        )

    def post(self, request: Request, organization: Organization) -> Response:
        if not features.has(
            "organizations:feature-flag-audit-log", organization, actor=request.user
        ):
            return Response("Not enabled.", status=404)

        validator = FlagWebhookSigningSecretValidator(data=request.data)
        if not validator.is_valid():
            return self.respond(validator.errors, status=400)

        # these scopes can always update or post secrets
        has_permission = request.access.has_scope("org:write") or request.access.has_scope(
            "org:admin"
        )

        try:
            secret = FlagWebHookSigningSecretModel.objects.filter(
                organization_id=organization.id
            ).get(provider=validator.validated_data["provider"])
            # allow update access if the user created the secret
            is_creator = request.user.id == secret.created_by
        except FlagWebHookSigningSecretModel.DoesNotExist:
            # anyone can post a new secret
            is_creator = True

        if is_creator or has_permission:
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
        else:
            return Response(
                "You must be an organization owner or manager, or the creator of this secret in order to perform this action.",
                status=403,
            )


@region_silo_endpoint
class OrganizationFlagsWebHookSigningSecretEndpoint(OrganizationEndpoint):
    owner = ApiOwner.REPLAY
    permission_classes = (OrganizationFlagWebHookSigningSecretPermission,)
    publish_status = {"DELETE": ApiPublishStatus.PRIVATE}

    def delete(
        self, request: Request, organization: Organization, signing_secret_id: str
    ) -> Response:
        if not features.has(
            "organizations:feature-flag-audit-log", organization, actor=request.user
        ):
            return Response("Not enabled.", status=404)

        try:
            model = FlagWebHookSigningSecretModel.objects.filter(
                organization_id=organization.id
            ).get(id=int(signing_secret_id))
            model.delete()
        except FlagWebHookSigningSecretModel.DoesNotExist:
            return Response(status=404)
        else:
            return Response(status=204)
