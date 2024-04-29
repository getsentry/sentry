import pytest

from sentry.incidents.models.alert_rule import AlertRule
from sentry.models.actor import ACTOR_TYPES, Actor
from sentry.models.team import Team
from sentry.models.user import User
from sentry.testutils.cases import TestMigrations
from sentry.utils.actor import ActorTuple


@pytest.mark.skip("Migration is no longer runnable. Retain until migration is removed.")
class BackfillAlertRuleUserTeamTest(TestMigrations):
    migrate_from = "0700_drop_fileid_controlavatar"
    migrate_to = "0701_backfill_alertrule_user_team"

    def setup_initial_state(self):
        self.org = self.create_organization(owner=self.user)
        self.team = self.create_team(organization=self.org, members=[self.user])

        self.user_actor = Actor.objects.create(type=ACTOR_TYPES["user"], user_id=self.user.id)
        self.team_actor = Actor.objects.get(type=ACTOR_TYPES["team"], team_id=self.team.id)
        self.team_alert = self.create_alert_rule(
            organization=self.org,
            projects=[self.project],
            owner=ActorTuple(id=self.team.id, type=Team),
        )
        self.user_alert = self.create_alert_rule(
            organization=self.org,
            projects=[self.project],
            owner=ActorTuple(id=self.user.id, type=User),
        )

        other_user = self.create_user()
        self.valid = self.create_alert_rule(
            organization=self.org,
            projects=[self.project],
            owner=ActorTuple(id=other_user.id, type=User),
        )

        # Use QuerySet.update() to avoid validation in AlertRule
        AlertRule.objects.filter(id__in=[self.team_alert.id, self.user_alert.id]).update(
            team_id=None, user_id=None
        )

    def test(self):
        self.user_alert.refresh_from_db()
        self.team_alert.refresh_from_db()
        self.valid.refresh_from_db()

        assert self.user_alert.user_id == self.user.id
        assert self.user_alert.team_id is None

        assert self.team_alert.team_id == self.team.id
        assert self.team_alert.user_id is None

        assert self.valid.team_id is None
        assert self.valid.user_id
