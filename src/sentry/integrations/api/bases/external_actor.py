from collections.abc import Mapping, MutableMapping
from typing import Any, TypedDict

from django.db import IntegrityError
from django.http import Http404
from drf_spectacular.utils import extend_schema_serializer
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request

from sentry import features
from sentry.api.serializers.rest_framework.base import CamelSnakeModelSerializer
from sentry.integrations.models.external_actor import ExternalActor
from sentry.integrations.types import ExternalProviders
from sentry.integrations.utils.providers import get_provider_choices
from sentry.integrations.validators.external_actor import (
    is_valid_provider,
    validate_external_id_option,
    validate_external_name,
    validate_integration_id,
)
from sentry.integrations.validators.integrations import validate_provider
from sentry.models.organization import Organization
from sentry.models.team import Team
from sentry.organizations.services.organization import organization_service
from sentry.users.services.user import RpcUser
from sentry.users.services.user.service import user_service

AVAILABLE_PROVIDERS = {
    ExternalProviders.GITHUB,
    ExternalProviders.GITHUB_ENTERPRISE,
    ExternalProviders.GITLAB,
    ExternalProviders.SLACK,
    ExternalProviders.MSTEAMS,
    ExternalProviders.CUSTOM,
}

STRICT_NAME_PROVIDERS = {
    ExternalProviders.GITHUB,
    ExternalProviders.GITLAB,
}


class ExternalActorResponse(TypedDict):
    id: int
    external_id: str | None
    external_name: str
    provider: int
    integration_id: int


class ExternalActorSerializerBase(CamelSnakeModelSerializer):
    external_id = serializers.CharField(
        required=False, allow_null=True, help_text="The associated user ID for provider."
    )
    external_name = serializers.CharField(
        required=True, help_text="The associated name for the provider."
    )
    provider = serializers.ChoiceField(
        choices=get_provider_choices(AVAILABLE_PROVIDERS),
        help_text="The provider of the external actor.",
    )
    integration_id = serializers.IntegerField(required=True, help_text="The Integration ID.")
    _actor_key: str

    @property
    def organization(self) -> Organization:
        return self.context["organization"]

    def validate_integration_id(self, integration_id: str) -> str:
        return validate_integration_id(integration_id, self.organization)

    def validate_external_id(self, external_id: str) -> str | None:
        return validate_external_id_option(external_id)

    def validate_external_name(self, external_name: str) -> str:
        provider = self.initial_data.get("provider")
        # Ensure the provider is strict, otherwise do not validate
        if is_valid_provider(provider, STRICT_NAME_PROVIDERS):
            return validate_external_name(external_name)
        return external_name

    def validate_provider(self, provider_name_option: str) -> int:
        provider = validate_provider(provider_name_option, available_providers=AVAILABLE_PROVIDERS)
        return int(provider.value)

    def get_actor_params(self, validated_data: MutableMapping[str, Any]) -> Mapping[str, int]:
        actor_model = validated_data.pop(self._actor_key)
        if isinstance(actor_model, Team):
            return dict(team_id=actor_model.id)
        else:
            return dict(user_id=actor_model.id)

    def create(self, validated_data: MutableMapping[str, Any]) -> tuple[ExternalActor, bool]:
        actor_params = self.get_actor_params(validated_data)
        return ExternalActor.objects.get_or_create(
            **validated_data,
            organization=self.organization,
            defaults=actor_params,
        )

    def update(
        self, instance: ExternalActor, validated_data: MutableMapping[str, Any]
    ) -> ExternalActor:
        # Discard the object ID passed by the API.
        if "id" in validated_data:
            validated_data.pop("id")

        if self._actor_key in validated_data:
            validated_data.update(self.get_actor_params({**validated_data}))

        for key, value in validated_data.items():
            setattr(self.instance, key, value)
        try:
            assert type(self.instance) is ExternalActor, "Instance type must be ExternalActor"
            self.instance.save()
            return self.instance
        except IntegrityError:
            raise serializers.ValidationError(
                "There already exists an external association with this external_name and provider."
            )


class ExternalUserSerializer(ExternalActorSerializerBase):
    _actor_key = "user_id"

    user_id = serializers.IntegerField(required=True, help_text="The user ID in Sentry.")
    id = serializers.IntegerField(
        required=False, read_only=True, help_text="The external actor ID."
    )

    def validate_user_id(self, user_id: int) -> RpcUser:
        """Ensure that this user exists and that they belong to the organization."""
        if (
            organization_service.check_membership_by_id(
                user_id=user_id, organization_id=self.organization.id
            )
            is None
            or (user := user_service.get_user(user_id=user_id)) is None
        ):
            raise serializers.ValidationError("This member does not exist.")
        return user

    def serialize(self, instance: ExternalActor) -> ExternalActorResponse:
        return {
            "id": instance.id,
            "external_id": instance.external_id,
            "external_name": instance.external_name,
            "provider": instance.provider,
            "integration_id": instance.integration_id,
        }

    class Meta:
        model = ExternalActor
        fields = ["user_id", "external_id", "external_name", "provider", "integration_id", "id"]


@extend_schema_serializer(exclude_fields=["team_id"])
class ExternalTeamSerializer(ExternalActorSerializerBase):
    _actor_key = "team_id"

    team_id = serializers.IntegerField(required=True)

    def validate_team_id(self, team_id: int) -> Team:
        """Ensure that this team exists and that they belong to the organization."""
        try:
            return Team.objects.get(id=team_id, organization=self.organization)
        except Team.DoesNotExist:
            raise serializers.ValidationError("This team does not exist.")

    class Meta:
        model = ExternalActor
        fields = ["team_id", "external_id", "external_name", "provider", "integration_id"]


class ExternalActorEndpointMixin:
    @staticmethod
    def has_feature(request: Request, organization: Organization) -> bool:
        return bool(
            features.has("organizations:integrations-codeowners", organization, actor=request.user)
        )

    def assert_has_feature(self, request: Request, organization: Organization) -> None:
        if not self.has_feature(request, organization):
            raise PermissionDenied

    @staticmethod
    def get_external_actor_or_404(
        external_actor_id: int, organization: Organization
    ) -> ExternalActor:
        try:
            return ExternalActor.objects.get(id=external_actor_id, organization=organization)
        except ExternalActor.DoesNotExist:
            raise Http404
