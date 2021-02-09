import logging

from rest_framework import serializers, status
from rest_framework.response import Response

from sentry.api.bases.team import TeamEndpoint
from sentry.api.serializers import serialize
from sentry.models import ExternalTeam, EXTERNAL_PROVIDERS

logger = logging.getLogger(__name__)


class ExternalTeamSerializer(serializers.ModelSerializer):
    provider = serializers.ChoiceField(choices=list(EXTERNAL_PROVIDERS.values()))

    class Meta:
        model = ExternalTeam
        fields = ["team_id", "external_id", "provider"]

    def validate_provider(self, provider):
        if provider not in EXTERNAL_PROVIDERS.values():
            raise serializers.ValidationError(
                f'The provider "{provider}" is not supported. We currently accept Github and Gitlab team identities.'
            )
        inv_providers_map = {v: k for k, v in EXTERNAL_PROVIDERS.items()}
        return inv_providers_map[provider].value

    def create(self, validated_data):
        return ExternalTeam.objects.create(team=self.context["team"], **validated_data)

    def update(self, instance, validated_data):
        if "id" in validated_data:
            validated_data.pop("id")
        for key, value in validated_data.items():
            setattr(self.instance, key, value)
        self.instance.save()
        return self.instance


class ExternalTeamEndpoint(TeamEndpoint):
    def post(self, request, team):
        """
        Create an External Team
        `````````````

        Update various attributes and configurable settings for the given
        team.

        :pparam string organization_slug: the slug of the organization the
                                          team belongs to.
        :pparam string team_slug: the slug of the team to get.
        :param required string provider: enum("github", "gitlab")
        :param required string external_id: the associated Github/Gitlab team name.
        :auth: required
        """
        serializer = ExternalTeamSerializer(context={"team": team}, data=request.data)
        if serializer.is_valid():
            external_team = serializer.save()
            return Response(serialize(external_team, request.user), status=status.HTTP_201_CREATED)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
