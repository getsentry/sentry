from __future__ import absolute_import

from sentry.models import ScheduledDeletion, Team
from sentry.tasks.deletion import run_deletion
from sentry.testutils import TestCase


class DeleteTeamTest(TestCase):
    def test_simple(self):
        team = self.create_team(
            name='test',
        )
        self.create_project(team=team, name='test1')
        self.create_project(team=team, name='test2')

        deletion = ScheduledDeletion.schedule(team, days=0)
        deletion.update(in_progress=True)

        with self.tasks():
            run_deletion(deletion.id)

        assert not Team.objects.filter(id=team.id).exists()
