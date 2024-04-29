import pytest

from sentry.models.actor import ACTOR_TYPES, Actor
from sentry.models.grouphistory import GroupHistory, GroupHistoryStatus, record_group_history
from sentry.testutils.cases import TestMigrations


@pytest.mark.skip("Migration is no longer runnable. Retain until migration is removed.")
class BackfillGroupHistoryUserTeamTest(TestMigrations):
    migrate_from = "0705_grouphistory_add_userteam"
    migrate_to = "0706_grouphistory_userteam_backfill"

    def setup_initial_state(self):
        self.org = self.create_organization(owner=self.user)
        self.team = self.create_team(organization=self.org, members=[self.user])
        self.project = self.create_project(organization=self.org)
        self.group = self.create_group(project=self.project)
        other_user = self.create_user()

        self.user_actor = Actor.objects.create(type=ACTOR_TYPES["user"], user_id=self.user.id)
        self.team_actor = Actor.objects.get(type=ACTOR_TYPES["team"], team_id=self.team.id)
        self.team_history = record_group_history(
            group=self.group, actor=self.team, status=GroupHistoryStatus.RESOLVED
        )
        self.user_history = record_group_history(
            group=self.group, actor=self.user, status=GroupHistoryStatus.ESCALATING
        )
        self.valid = record_group_history(
            group=self.group, actor=other_user, status=GroupHistoryStatus.ONGOING
        )

        # Use QuerySet.update() to avoid validation in GroupHistory
        GroupHistory.objects.filter(id__in=[self.team_history.id, self.user_history.id]).update(
            team_id=None, user_id=None
        )

    def test(self):
        self.user_history.refresh_from_db()
        self.team_history.refresh_from_db()
        self.valid.refresh_from_db()

        assert self.user_history.user_id == self.user.id
        assert self.user_history.team_id is None

        assert self.team_history.team_id == self.team.id
        assert self.team_history.user_id is None

        assert self.valid.team_id is None
        assert self.valid.user_id
