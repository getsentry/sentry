from sentry.api.serializers import serialize
from sentry.models import ExternalActor, Integration
from sentry.testutils import TestCase
from sentry.types.integrations import ExternalProviders


class ExternalActorSerializerTest(TestCase):
    def setUp(self):
        self.user = self.create_user()
        self.organization = self.create_organization(owner=self.user)
        self.integration = Integration.objects.create(
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
            actor_id=self.user.actor_id,
            organization=self.organization,
            integration=self.integration,
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
            actor_id=team.actor_id,
            organization=self.organization,
            integration=self.integration,
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
