from sentry.api.serializers import serialize
from sentry.integrations.api.bases.external_actor import (
    STRICT_NAME_PROVIDERS,
    ExternalTeamSerializer,
    ExternalUserSerializer,
)
from sentry.integrations.models.external_actor import ExternalActor
from sentry.integrations.types import ExternalProviders
from sentry.integrations.utils.providers import get_provider_name
from sentry.testutils.cases import TestCase


class ExternalActorSerializerTest(TestCase):
    def setUp(self):
        self.user = self.create_user()
        self.organization = self.create_organization(owner=self.user)
        self.integration, self.org_integration = self.create_provider_integration_for(
            self.organization,
            self.user,
            provider="slack",
            name="Team A",
            external_id="TXXXXXXX1",
            metadata={
                "access_token": "xoxp-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx",
                "installation_type": "born_as_bot",
            },
        )

    def test_user(self):
        external_actor, _ = ExternalActor.objects.get_or_create(
            user_id=self.user.id,
            organization=self.organization,
            integration_id=self.integration.id,
            provider=ExternalProviders.SLACK.value,
            external_name="Marcos",
            external_id="Gaeta",
        )

        result = serialize(external_actor, self.user, key="user")

        assert "actorId" not in result
        assert result["id"] == str(external_actor.id)
        assert result["externalName"] == "Marcos"
        assert result["externalId"] == "Gaeta"
        assert result["userId"] == str(self.user.id)

    def test_team(self):
        team = self.create_team(organization=self.organization, members=[self.user])

        external_actor, _ = ExternalActor.objects.get_or_create(
            team_id=team.id,
            organization=self.organization,
            integration_id=self.integration.id,
            provider=ExternalProviders.SLACK.value,
            external_name="Marcos",
            external_id="Gaeta",
        )

        result = serialize(external_actor, self.user, key="team")

        assert "actorId" not in result
        assert result["id"] == str(external_actor.id)
        assert result["externalName"] == "Marcos"
        assert result["externalId"] == "Gaeta"
        assert result["teamId"] == str(team.id)

    def test_strict_external_user_name(self):
        # Ensure user names must start with @
        external_actor_user_data = {
            "provider": get_provider_name(ExternalProviders.GITHUB.value),
            "externalName": "raz",
            "integrationId": self.integration.id,
            "userId": self.user.id,
        }
        serializer = ExternalUserSerializer(
            data=external_actor_user_data,
            context={"organization": self.organization},
        )
        assert serializer.is_valid() is False
        assert "externalName" in serializer.errors

        # Ensure longer user names are limited in length
        external_actor_user_data["externalName"] = "@" + ("razputin_aquato" * 20)
        serializer = ExternalUserSerializer(
            data=external_actor_user_data,
            context={"organization": self.organization},
        )
        assert serializer.is_valid() is False
        assert "externalName" in serializer.errors

        # Ensure proper user names are valid
        external_actor_user_data["externalName"] = "@raz"
        serializer = ExternalUserSerializer(
            data=external_actor_user_data,
            context={"organization": self.organization},
        )
        assert serializer.is_valid() is True

    def test_strict_external_team_name(self):
        team = self.create_team(organization=self.organization, members=[self.user])

        # Ensure team names must start with @
        external_actor_team_data = {
            "provider": get_provider_name(ExternalProviders.GITHUB.value),
            "externalName": "the-psychic-six",
            "integrationId": self.integration.id,
            "team_id": team.id,
        }
        serializer = ExternalTeamSerializer(
            data=external_actor_team_data,
            context={"organization": self.organization},
        )
        assert serializer.is_valid() is False
        assert "externalName" in serializer.errors

        # Ensure longer team names are limited in length
        external_actor_team_data["externalName"] = "@" + ("the-psychic-six" * 20)
        serializer = ExternalTeamSerializer(
            data=external_actor_team_data,
            context={"organization": self.organization},
        )
        assert serializer.is_valid() is False
        assert "externalName" in serializer.errors

        # Ensure proper team names are valid
        external_actor_team_data["externalName"] = "@the-psychic-six"
        serializer = ExternalTeamSerializer(
            data=external_actor_team_data,
            context={"organization": self.organization},
        )
        assert serializer.is_valid() is True

    def test_avoid_strict_external_name(self):
        # Strict rules should only run for strict providers
        provider = get_provider_name(ExternalProviders.SLACK.value)
        assert provider not in STRICT_NAME_PROVIDERS
        external_actor_user_data = {
            "provider": get_provider_name(ExternalProviders.SLACK.value),
            "externalName": "ford-cruller",
            "integrationId": self.integration.id,
            "userId": self.user.id,
        }
        serializer = ExternalUserSerializer(
            data=external_actor_user_data,
            context={"organization": self.organization},
        )
        assert serializer.is_valid() is True
