from __future__ import absolute_import

from sentry import tagstore
from sentry.tagstore.models import EventTag
from sentry.models import ScheduledDeletion
from sentry.tasks.deletion import run_deletion
from sentry.testutils import TestCase


class DeleteTagKeyTest(TestCase):
    def test_simple(self):
        team = self.create_team(name='test', slug='test')
        project = self.create_project(teams=[team], name='test1', slug='test1')
        group = self.create_group(project=project)
        key = 'foo'
        value = 'bar'
        tk = tagstore.create_tag_key(
            key=key,
            project_id=project.id,
            environment_id=self.environment.id)
        tv = tagstore.create_tag_value(
            key=key,
            value=value,
            project_id=project.id,
            environment_id=self.environment.id)
        tagstore.create_group_tag_key(
            key=key,
            group_id=group.id,
            project_id=project.id,
            environment_id=self.environment.id)
        tagstore.create_group_tag_value(
            key=key, value=value, group_id=group.id, project_id=project.id, environment_id=self.environment.id
        )
        tagstore.create_event_tags(
            group_id=group.id,
            project_id=project.id,
            event_id=1,
            environment_id=self.environment.id,
            tags=[
                (tk.key, tv.value),
            ]
        )

        project2 = self.create_project(teams=[team], name='test2')
        env2 = self.create_environment(project=project2)
        group2 = self.create_group(project=project2)
        tk2 = tagstore.create_tag_key(project2.id, env2.id, key)
        tv2 = tagstore.create_tag_value(
            key=key,
            value=value,
            project_id=project2.id,
            environment_id=env2.id,
        )
        tagstore.create_group_tag_key(
            key=key,
            group_id=group2.id,
            project_id=project2.id,
            environment_id=env2.id)
        tagstore.create_group_tag_value(
            key=key, value=value, group_id=group2.id, project_id=project2.id, environment_id=env2.id
        )
        tagstore.create_event_tags(
            group_id=group2.id,
            project_id=project2.id,
            environment_id=env2.id,
            event_id=1,
            tags=[
                (tk2.key, tv2.value),
            ],
        )

        deletion = ScheduledDeletion.schedule(tk, days=0)
        deletion.update(in_progress=True)

        with self.tasks():
            run_deletion(deletion.id)

        try:
            tagstore.get_group_tag_value(
                group.project_id, group.id, self.environment.id, key, value)
            assert False  # verify exception thrown
        except tagstore.GroupTagValueNotFound:
            pass
        try:
            tagstore.get_group_tag_key(group.project_id, group.id, self.environment.id, key)
            assert False  # verify exception thrown
        except tagstore.GroupTagKeyNotFound:
            pass
        try:
            tagstore.get_tag_value(project.id, self.environment.id, key, value)
            assert False  # verify exception thrown
        except tagstore.TagValueNotFound:
            pass
        try:
            tagstore.get_tag_key(project.id, self.environment.id, key)
            assert False  # verify exception thrown
        except tagstore.TagKeyNotFound:
            pass

        assert tagstore.get_tag_key(project2.id, env2.id, key) is not None
        assert tagstore.get_group_tag_key(group2.project_id, group2.id, env2.id, key) is not None
        assert tagstore.get_group_tag_value(
            group2.project_id, group2.id, env2.id, key, value) is not None
        assert EventTag.objects.filter(key_id=tk2.id).exists()
