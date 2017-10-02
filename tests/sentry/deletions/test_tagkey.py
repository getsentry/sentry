from __future__ import absolute_import

from sentry import tagstore
from sentry.models import (
    EventTag, GroupTagKey, GroupTagValue, ScheduledDeletion
)
from sentry.tasks.deletion import run_deletion
from sentry.testutils import TestCase


class DeleteTagKeyTest(TestCase):
    def test_simple(self):
        team = self.create_team(name='test', slug='test')
        project = self.create_project(team=team, name='test1', slug='test1')
        group = self.create_group(project=project)
        key = 'foo'
        value = 'bar'
        tk = tagstore.create_tag_key(key=key, project_id=project.id)
        tagstore.create_tag_value(key=key, value=value, project_id=project.id)
        GroupTagKey.objects.create(key=key, group_id=group.id, project_id=project.id)
        GroupTagValue.objects.create(
            key=key, value=value, group_id=group.id, project_id=project.id
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
        tk2 = tagstore.create_tag_key(key=key, project_id=project2.id)
        gtk2 = GroupTagKey.objects.create(key=key, group_id=group2.id, project_id=project2.id)
        gtv2 = GroupTagValue.objects.create(
            key=key, value=value, group_id=group2.id, project_id=project2.id
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
        try:
            tagstore.get_tag_value(project.id, key, value)
            assert False  # verify exception thrown
        except ObjectDoesNotExist:
            pass
        try:
            tagstore.get_tag_key(project.id, key)
            assert False  # verify exception thrown
        except tagstore.TagKeyNotFound:
            pass
        assert not EventTag.objects.filter(key_id=tk.id).exists()

        assert tagstore.get_tag_key(key=key, project_id=project2.id) is not None
        assert GroupTagKey.objects.filter(id=gtk2.id).exists()
        assert GroupTagValue.objects.filter(id=gtv2.id).exists()
        assert EventTag.objects.filter(key_id=tk2.id).exists()
