from sentry.api.serializers import serialize
from sentry.models import ExternalActor
from sentry.testutils import TestCase
from sentry.types.integrations import ExternalProviders


class ExternalActorSerializerTest(TestCase):
    def test_user(self):
        user = self.create_user()
        organization = self.create_organization(owner=user)

        external_actor, _ = ExternalActor.objects.get_or_create(
            actor_id=user.actor_id,
            organization=organization,
            integration=None,
            provider=ExternalProviders.SLACK.value,
            external_name="Marcos",
            external_id="Gaeta",
        )

        result = serialize(external_actor, user, key="user")

        assert result["id"] == str(external_actor.id)
        assert result["externalName"] == "Marcos"
        assert result["externalId"] == "Gaeta"
        assert result["userId"] == user.id

    def test_team(self):
        user = self.create_user()
        organization = self.create_organization(owner=user)
        team = self.create_team(organization=organization, members=[self.user])

        external_actor, _ = ExternalActor.objects.get_or_create(
            actor_id=team.actor_id,
            organization=organization,
            integration=None,
            provider=ExternalProviders.SLACK.value,
            external_name="Marcos",
            external_id="Gaeta",
        )

        result = serialize(external_actor, user, key="team")

        assert result["id"] == str(external_actor.id)
        assert result["externalName"] == "Marcos"
        assert result["externalId"] == "Gaeta"
        assert result["teamId"] == team.id
