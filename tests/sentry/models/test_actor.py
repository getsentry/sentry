from sentry.models.actor import Actor, get_actor_for_user
from sentry.testutils.cases import TestCase


class ActorTest(TestCase):
    def test_pre_save(self):
        user = self.create_user(email="test@pre_save.com")
        assert Actor.objects.filter(user_id=user.id).first() is None

        team = self.create_team(name="pre save team", organization=self.organization)
        assert team.actor is not None
        assert type(team.actor) is Actor
        assert team.actor.team_id == team.id

    def test_get_actor_for_user(self):
        user = self.create_user(email="test@example.com")
        assert Actor.objects.filter(user_id=user.id).first() is None

        actor = get_actor_for_user(user)
        assert isinstance(actor, Actor)
        assert actor.user_id == user.id

        actor_copy = get_actor_for_user(user)
        assert actor.id == actor_copy.id
