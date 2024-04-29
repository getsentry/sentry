import pytest

from sentry.models.actor import ACTOR_TYPES, Actor
from sentry.models.rule import Rule
from sentry.testutils.cases import TestMigrations


@pytest.mark.skip("Migration is no longer runnable. Retain until migration is removed.")
class BackfillRuleUserTeamTest(TestMigrations):
    migrate_from = "0703_add_team_user_to_rule"
    migrate_to = "0704_backfill_rule_user_team"

    def setup_initial_state(self):
        self.org = self.create_organization(owner=self.user)
        self.team = self.create_team(organization=self.org, members=[self.user])
        self.project = self.create_project(organization=self.org)

        self.user_actor = Actor.objects.create(type=ACTOR_TYPES["user"], user_id=self.user.id)
        self.team_actor = Actor.objects.get(type=ACTOR_TYPES["team"], team_id=self.team.id)
        self.team_rule = Rule.objects.create(
            project=self.project,
            label="team rule",
            owner_team=self.team,
        )
        self.user_rule = Rule.objects.create(
            project=self.project,
            label="user rule",
            owner_user_id=self.user.id,
        )

        other_user = self.create_user()
        self.valid = Rule.objects.create(
            project=self.project,
            label="valid",
            owner_user_id=other_user.id,
        )

        # Use QuerySet.update() to avoid validation in AlertRule
        Rule.objects.filter(id__in=[self.team_rule.id, self.user_rule.id]).update(
            owner_team_id=None, owner_user_id=None
        )

    def test(self):
        self.user_rule.refresh_from_db()
        self.team_rule.refresh_from_db()
        self.valid.refresh_from_db()

        assert self.user_rule.owner_user_id == self.user.id
        assert self.user_rule.owner_team_id is None

        assert self.team_rule.owner_team_id == self.team.id
        assert self.team_rule.owner_user_id is None

        assert self.valid.owner_team_id is None
        assert self.valid.owner_user_id
