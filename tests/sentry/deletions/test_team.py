from sentry.models.project import Project
from sentry.models.projectteam import ProjectTeam
from sentry.models.rule import Rule
from sentry.models.team import Team
from sentry.tasks.deletion.scheduled import run_scheduled_deletions
from sentry.testutils.cases import TestCase
from sentry.testutils.hybrid_cloud import HybridCloudTestMixin
from sentry.testutils.silo import region_silo_test


@region_silo_test
class DeleteTeamTest(TestCase, HybridCloudTestMixin):
    def test_simple(self):
        team = self.create_team(name="test")
        project1 = self.create_project(teams=[team], name="test1")
        project2 = self.create_project(teams=[team], name="test2")
        assert project1.teams.first() == team
        assert project2.teams.first() == team

        self.ScheduledDeletion.schedule(instance=team, days=0)

        with self.tasks():
            run_scheduled_deletions()

        assert not Team.objects.filter(id=team.id).exists()
        assert Project.objects.filter(id=project1.id).exists()
        assert Project.objects.filter(id=project2.id).exists()
        assert not ProjectTeam.objects.filter(team_id=team.id).exists()

    def test_alert_blanking(self):
        team = self.create_team(name="test")
        project = self.create_project(teams=[team], name="test1")
        rule = Rule.objects.create(label="test rule", project=project, owner=team.actor)
        alert_rule = self.create_alert_rule(
            name="test alert rule", owner=team.actor.get_actor_tuple(), projects=[project]
        )
        self.ScheduledDeletion.schedule(team, days=0)

        with self.tasks():
            run_scheduled_deletions()

        assert not Team.objects.filter(id=team.id).exists()
        assert Project.objects.filter(id=project.id).exists()

        alert_rule.refresh_from_db()
        rule.refresh_from_db()
        assert rule.owner_id is None, "Should be blank when team is deleted."
        assert alert_rule.owner_id is None, "Should be blank when team is deleted."
