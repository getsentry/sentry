from __future__ import absolute_import

from sentry.models import (
    EventTag, GroupTagKey, GroupTagValue, ScheduledDeletion, TagKey, TagValue
)
from sentry.tasks.deletion import run_deletion
from sentry.testutils import TestCase


class DeleteTagKeyTest(TestCase):
    def test_simple(self):
        team = self.create_team(name='test', slug='test')
        project = self.create_project(team=team, name='test1', slug='test1')
        group = self.create_group(project=project)
        tk = TagKey.objects.create(key='foo', project_id=project.id)
        TagValue.objects.create(key='foo', value='bar', project_id=project.id)
        GroupTagKey.objects.create(key='foo', group_id=group.id, project_id=project.id)
        GroupTagValue.objects.create(
            key='foo', value='bar', group_id=group.id, project_id=project.id
        )
        EventTag.objects.create(
            key_id=tk.id,
            group_id=group.id,
            value_id=1,
            project_id=project.id,
            event_id=1,
        )

        project2 = self.create_project(team=team, name='test2')
        group2 = self.create_group(project=project2)
        tk2 = TagKey.objects.create(key='foo', project_id=project2.id)
        gtk2 = GroupTagKey.objects.create(key='foo', group_id=group2.id, project_id=project2.id)
        gtv2 = GroupTagValue.objects.create(
            key='foo', value='bar', group_id=group2.id, project_id=project2.id
        )
        EventTag.objects.create(
            key_id=tk2.id,
            group_id=group2.id,
            value_id=1,
            project_id=project.id,
            event_id=1,
        )

        deletion = ScheduledDeletion.schedule(tk, days=0)
        deletion.update(in_progress=True)

        with self.tasks():
            run_deletion(deletion.id)

        assert not GroupTagValue.objects.filter(key=tk.key, project_id=project.id).exists()
        assert not GroupTagKey.objects.filter(key=tk.key, project_id=project.id).exists()
        assert not TagValue.objects.filter(key=tk.key, project_id=project.id).exists()
        assert not TagKey.objects.filter(id=tk.id).exists()
        assert not EventTag.objects.filter(key_id=tk.id).exists()

        assert TagKey.objects.filter(id=tk2.id).exists()
        assert GroupTagKey.objects.filter(id=gtk2.id).exists()
        assert GroupTagValue.objects.filter(id=gtv2.id).exists()
        assert EventTag.objects.filter(key_id=tk2.id).exists()
