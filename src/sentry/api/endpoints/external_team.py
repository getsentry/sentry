import logging

from django.db import IntegrityError
from rest_framework import serializers, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from sentry import features
from sentry.api.bases.team import TeamEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework.base import CamelSnakeModelSerializer
from sentry.models import EXTERNAL_PROVIDERS, ExternalTeam

logger = logging.getLogger(__name__)


class ExternalTeamSerializer(CamelSnakeModelSerializer):
    team_id = serializers.IntegerField(required=True)
    external_name = serializers.CharField(required=True)
    provider = serializers.ChoiceField(choices=list(EXTERNAL_PROVIDERS.values()))

    class Meta:
        model = ExternalTeam
        fields = ["team_id", "external_name", "provider"]

    def validate_provider(self, provider):
        if provider not in EXTERNAL_PROVIDERS.values():
            raise serializers.ValidationError(
                f'The provider "{provider}" is not supported. We currently accept GitHub and GitLab team identities.'
            )
        return ExternalTeam.get_provider_enum(provider)

    def create(self, validated_data):
        return ExternalTeam.objects.get_or_create(**validated_data)

    def update(self, instance, validated_data):
        if "id" in validated_data:
            validated_data.pop("id")
        for key, value in validated_data.items():
            setattr(self.instance, key, value)
        try:
            self.instance.save()
            return self.instance
        except IntegrityError:
            raise serializers.ValidationError(
                "There already exists an external team association with this external_name and provider."
            )


class ExternalTeamMixin:
    def has_feature(self, request, team):
        return features.has(
            "organizations:import-codeowners", team.organization, actor=request.user
        )


class ExternalTeamEndpoint(TeamEndpoint, ExternalTeamMixin):
    def post(self, request, team):
        """
        Create an External Team
        `````````````

        :pparam string organization_slug: the slug of the organization the
                                          team belongs to.
        :pparam string team_slug: the slug of the team to get.
        :param required string provider: enum("github", "gitlab")
        :param required string external_name: the associated Github/Gitlab team name.
        :auth: required
        """
        if not self.has_feature(request, team):
            raise PermissionDenied

        serializer = ExternalTeamSerializer(data={**request.data, "team_id": team.id})
        if serializer.is_valid():
            external_team, created = serializer.save()
            status_code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
            return Response(serialize(external_team, request.user), status=status_code)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
