from sentry.api.serializers import serialize
from sentry.api.serializers.models.actor import ActorSerializer
from sentry.testutils.cases import TestCase


class ActorSerializerTest(TestCase):
    def test_user(self) -> None:
        user = self.create_user(email="actor@example.com", name="Actor User")
        result = serialize(user, self.user, ActorSerializer())

        assert result == {
            "type": "user",
            "id": str(user.id),
            "name": user.get_display_name(),
            "email": user.email,
        }

    def test_team(self) -> None:
        team = self.create_team(name="Actor Team", slug="actor-team")
        result = serialize(team, self.user, ActorSerializer())

        assert result == {"type": "team", "id": str(team.id), "name": team.slug}
