from mock import patch

from sentry.models import (
    GroupTagKey, GroupTagValue, Project, TagKey, TagValue, Team, TeamStatus
)
from sentry.tasks.deletion import delete_tag_key, delete_team
from sentry.testutils import TestCase


class DeleteTeamTest(TestCase):
    @patch.object(delete_team, 'delay')
    def test_simple(self, delete_team_delay):
        team = self.create_team(name='test', slug='test')
        project1 = self.create_project(team=team, name='test1', slug='test1')
        project2 = self.create_project(team=team, name='test2', slug='test2')

        with self.settings(CELERY_ALWAYS_EAGER=True):
            delete_team(object_id=team.id)

            team = Team.objects.get(id=team.id)

            assert team.status == TeamStatus.DELETION_IN_PROGRESS

            assert not Project.objects.filter(id=project1.id).exists()

            delete_team_delay.assert_called_once_with(object_id=team.id, countdown=15)

            delete_team_delay.reset_mock()

            delete_team(object_id=team.id)

            assert not Project.objects.filter(id=project2.id).exists()

            delete_team_delay.assert_called_once_with(object_id=team.id, countdown=15)

            delete_team_delay.reset_mock()

            delete_team(object_id=team.id)

            assert not delete_team_delay.called

            assert not Team.objects.filter(id=team.id).exists()


class DeleteTagKeyTest(TestCase):
    @patch.object(delete_tag_key, 'delay')
    def test_simple(self, delete_tag_key_delay):
        team = self.create_team(name='test', slug='test')
        project = self.create_project(team=team, name='test1', slug='test1')
        group = self.create_group(project=project)
        tk = TagKey.objects.create(key='foo', project=project)
        TagValue.objects.create(key='foo', value='bar', project=project)
        GroupTagKey.objects.create(key='foo', group=group, project=project)
        GroupTagValue.objects.create(key='foo', value='bar', group=group, project=project)

        with self.settings(CELERY_ALWAYS_EAGER=True):
            delete_tag_key(object_id=tk.id)

            assert not GroupTagValue.objects.filter(key=tk.key, project=project).exists()

            delete_tag_key_delay.assert_called_once_with(object_id=tk.id, countdown=15)

            delete_tag_key_delay.reset_mock()

            delete_tag_key(object_id=tk.id)

            assert not GroupTagKey.objects.filter(key=tk.key, project=project).exists()

            delete_tag_key_delay.assert_called_once_with(object_id=tk.id, countdown=15)

            delete_tag_key_delay.reset_mock()

            delete_tag_key(object_id=tk.id)

            assert not TagValue.objects.filter(key=tk.key, project=project).exists()

            delete_tag_key_delay.assert_called_once_with(object_id=tk.id, countdown=15)

            delete_tag_key_delay.reset_mock()

            delete_tag_key(object_id=tk.id)

            assert not delete_tag_key_delay.called

            assert not TagKey.objects.filter(id=tk.id).exists()
