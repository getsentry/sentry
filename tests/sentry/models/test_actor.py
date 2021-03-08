from sentry.models import Actor, User
from sentry.testutils import TestCase


class ActorTest(TestCase):
    def test_pre_save(self):
        user = self.create_user(email="test@pre_save.com")
        assert user.actor is not None
        assert type(user.actor) is Actor

        team = self.create_team(name="pre save team", organization=self.organization)
        assert team.actor is not None
        assert type(team.actor) is Actor

        actor = Actor.objects.create(type=1)
        user2 = User.objects.create(username="meow", actor_id=actor.id)
        assert user2.actor == actor

        actor = Actor.objects.create(type=1)
        user3 = User.objects.create(username="woof", actor=actor)
        assert user3.actor == actor
