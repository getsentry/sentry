from mock import patch

from sentry.models import Project, Team, TeamStatus
from sentry.tasks.deletion import delete_team
from sentry.testutils import TestCase


class DeleteTeamTest(TestCase):
    @patch.object(delete_team, 'delay')
    def test_simple(self, delete_team_delay):
        user = self.create_user(email='foo@example.com')
        team = Team.objects.create(owner=user, name='test', slug='test')
        project1 = Project.objects.create(team=team, name='test1', slug='test1')
        project2 = Project.objects.create(team=team, name='test2', slug='test2')

        # remove relations from team so delete_team tests are faster
        team.member_set.all().delete()

        delete_team(object_id=team.id)

        team = Team.objects.get(id=team.id)

        assert team.status == TeamStatus.DELETION_IN_PROGRESS

        assert not Project.objects.filter(id=project1.id).exists()

        delete_team_delay.assert_called_once_with(object_id=team.id)

        delete_team_delay.reset_mock()

        delete_team(object_id=team.id)

        assert not Project.objects.filter(id=project2.id).exists()

        delete_team_delay.assert_called_once_with(object_id=team.id)

        delete_team_delay.reset_mock()

        delete_team(object_id=team.id)

        assert not delete_team_delay.called

        assert not Team.objects.filter(id=team.id).exists()
