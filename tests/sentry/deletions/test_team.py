from sentry.deletions.tasks.scheduled import run_scheduled_deletions
from sentry.models.project import Project
from sentry.models.projectteam import ProjectTeam
from sentry.models.rule import Rule
from sentry.models.team import Team
from sentry.monitors.models import Monitor, MonitorType
from sentry.testutils.cases import TestCase
from sentry.testutils.hybrid_cloud import HybridCloudTestMixin
from sentry.types.actor import Actor


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
        rule = Rule.objects.create(label="test rule", project=project, owner_team_id=team.id)
        alert_rule = self.create_alert_rule(
            name="test alert rule",
            owner=Actor.from_id(user_id=None, team_id=team.id),
            projects=[project],
        )
        self.ScheduledDeletion.schedule(team, days=0)

        with self.tasks():
            run_scheduled_deletions()

        assert not Team.objects.filter(id=team.id).exists()
        assert Project.objects.filter(id=project.id).exists()

        alert_rule.refresh_from_db()
        rule.refresh_from_db()
        assert rule.owner_team_id is None, "Should be blank when team is deleted."
        assert alert_rule.user_id is None, "Should be blank when team is deleted."
        assert alert_rule.team_id is None, "Should be blank when team is deleted."

    def test_monitor_blanking(self):
        team = self.create_team(name="test")
        monitor = Monitor.objects.create(
            organization_id=self.organization.id,
            project_id=self.project.id,
            type=MonitorType.CRON_JOB,
            name="My Awesome Monitor",
            owner_team_id=team.id,
        )
        self.ScheduledDeletion.schedule(team, days=0)

        with self.tasks():
            run_scheduled_deletions()

        assert not Team.objects.filter(id=team.id).exists()

        monitor.refresh_from_db()
        assert monitor.owner_team_id is None, "Should be blank when team is deleted."
        assert monitor.owner_user_id is None, "Should be blank when team is deleted."
