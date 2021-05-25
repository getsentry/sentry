from typing import Any, MutableMapping, Optional

from django.db import IntegrityError
from django.http import Http404
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request

from sentry import features
from sentry.api.serializers.rest_framework.base import CamelSnakeModelSerializer
from sentry.api.validators.external_actor import (
    validate_external_id_option,
    validate_integration_id,
)
from sentry.api.validators.integrations import validate_provider
from sentry.models import ExternalActor, Organization, Team, User
from sentry.types.integrations import ExternalProviders, get_provider_choices

AVAILABLE_PROVIDERS = {
    ExternalProviders.GITHUB,
    ExternalProviders.GITLAB,
    ExternalProviders.SLACK,
    ExternalProviders.CUSTOM,
}


class ExternalActorSerializerBase(CamelSnakeModelSerializer):  # type: ignore
    external_id = serializers.CharField(required=False, allow_null=True)
    external_name = serializers.CharField(required=True)
    provider = serializers.ChoiceField(choices=get_provider_choices(AVAILABLE_PROVIDERS))
    integration_id = serializers.IntegerField(required=True)

    @property
    def organization(self) -> Organization:
        return self.context["organization"]

    def validate_integration_id(self, integration_id: str) -> str:
        return validate_integration_id(integration_id, self.organization)

    def validate_external_id(self, external_id: str) -> Optional[str]:
        return validate_external_id_option(external_id)

    def validate_provider(self, provider_name_option: str) -> int:
        provider = validate_provider(provider_name_option, available_providers=AVAILABLE_PROVIDERS)
        return int(provider.value)

    def get_actor_id(self, validated_data: MutableMapping[str, Any]) -> int:
        return int(validated_data.pop(self._actor_key).actor_id)

    def create(self, validated_data: MutableMapping[str, Any]) -> ExternalActor:
        actor_id = self.get_actor_id(validated_data)
        return ExternalActor.objects.get_or_create(
            **validated_data,
            actor_id=actor_id,
            organization=self.organization,
        )

    def update(
        self, instance: ExternalActor, validated_data: MutableMapping[str, Any]
    ) -> ExternalActor:
        # Discard the object ID passed by the API.
        if "id" in validated_data:
            validated_data.pop("id")

        if self._actor_key in validated_data:
            validated_data["actor_id"] = self.get_actor_id({**validated_data})

        for key, value in validated_data.items():
            setattr(self.instance, key, value)
        try:
            self.instance.save()
            return self.instance
        except IntegrityError:
            raise serializers.ValidationError(
                "There already exists an external association with this external_name and provider."
            )


class ExternalUserSerializer(ExternalActorSerializerBase):
    _actor_key = "user_id"

    user_id = serializers.IntegerField(required=True)

    def validate_user_id(self, user_id: int) -> User:
        """ Ensure that this user exists and that they belong to the organization. """

        try:
            return User.objects.get(
                id=user_id, sentry_orgmember_set__organization=self.organization
            )
        except User.DoesNotExist:
            raise serializers.ValidationError("This member does not exist.")

    class Meta:
        model = ExternalActor
        fields = ["user_id", "external_id", "external_name", "provider", "integration_id"]


class ExternalTeamSerializer(ExternalActorSerializerBase):
    _actor_key = "team_id"

    team_id = serializers.IntegerField(required=True)

    def validate_team_id(self, team_id: int) -> Team:
        """ Ensure that this team exists and that they belong to the organization. """
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
    def get_external_actor_or_404(external_actor_id: int) -> ExternalActor:
        try:
            return ExternalActor.objects.get(id=external_actor_id)
        except ExternalActor.DoesNotExist:
            raise Http404
