from __future__ import absolute_import

from sentry.models import Project, ProjectTeam, ScheduledDeletion, Team
from sentry.tasks.deletion import run_deletion
from sentry.testutils import TestCase


class DeleteTeamTest(TestCase):
    def test_simple(self):
        team = self.create_team(name="test")
        project1 = self.create_project(teams=[team], name="test1")
        project2 = self.create_project(teams=[team], name="test2")
        assert project1.teams.first() == team
        assert project2.teams.first() == team

        deletion = ScheduledDeletion.schedule(team, days=0)
        deletion.update(in_progress=True)

        with self.tasks():
            run_deletion(deletion.id)

        assert not Team.objects.filter(id=team.id).exists()
        assert Project.objects.filter(id=project1.id).exists()
        assert Project.objects.filter(id=project2.id).exists()
        assert not ProjectTeam.objects.filter(team_id=team.id).exists()
