from django.test import override_settings

from sentry.models import Actor, User
from sentry.testutils import TestCase


class ActorTest(TestCase):

    SNOWFLAKE_ID_MIN = 1_000_000_000_000

    @override_settings(SENTRY_USE_SNOWFLAKE=False, SENTRY_USE_ACTOR_SNOWFLAKE=False)
    def test_pre_save(self):
        user = self.create_user(email="test@pre_save.com")
        assert user.actor is not None
        assert type(user.actor) is Actor
        assert user.actor.id < self.SNOWFLAKE_ID_MIN

        team = self.create_team(name="pre save team", organization=self.organization)
        assert team.actor is not None
        assert type(team.actor) is Actor
        assert team.actor.id < self.SNOWFLAKE_ID_MIN

        actor = Actor.objects.create(type=1)
        user2 = User.objects.create(username="meow", actor_id=actor.id)
        assert user2.actor == actor
        assert user2.actor.id < self.SNOWFLAKE_ID_MIN

        actor = Actor.objects.create(type=1)
        user3 = User.objects.create(username="woof", actor=actor)
        assert user3.actor == actor
        assert user3.actor.id < self.SNOWFLAKE_ID_MIN

    @override_settings(SENTRY_USE_SNOWFLAKE=True, SENTRY_USE_ACTOR_SNOWFLAKE=True)
    def test_pre_save_snowflake(self):
        user = self.create_user(email="test_snowflake@pre_save.com")
        assert user.actor is not None
        assert type(user.actor) is Actor
        assert user.actor.id > self.SNOWFLAKE_ID_MIN

        team = self.create_team(name="pre save team snowflake", organization=self.organization)
        assert team.actor is not None
        assert type(team.actor) is Actor
        assert team.actor.id > self.SNOWFLAKE_ID_MIN

        actor = Actor.objects.create(type=1)
        user2 = User.objects.create(username="meow", actor_id=actor.id)
        assert user2.actor == actor
        assert user2.actor.id > self.SNOWFLAKE_ID_MIN

        actor = Actor.objects.create(type=1)
        user3 = User.objects.create(username="woof", actor=actor)
        assert user3.actor == actor
        assert user3.actor.id > self.SNOWFLAKE_ID_MIN
