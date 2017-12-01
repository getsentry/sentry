from __future__ import absolute_import

from sentry.testutils import TestCase
from sentry.tagstore.v2.backend import TagStorage
from sentry.tagstore.v2.models import TagKey, TagValue, GroupTagKey, GroupTagValue, EventTag  # NOQA


class V2TagStorage(TestCase):
    def setUp(self):
        self.ts = TagStorage()

        self.proj1 = self.create_project()
        self.proj1env1 = self.create_environment(project=self.proj1)
        self.proj1env2 = self.create_environment(project=self.proj1)

        self.proj2 = self.create_project()
        self.proj2env1 = self.create_environment(project=self.proj2)
        self.proj2env2 = self.create_environment(project=self.proj2)

        self.key1 = 'key1'
        self.key2 = 'key2'

    def test_create_tag_key(self):
        self.ts.create_tag_key(
            project_id=self.proj1.id,
            environment_id=self.proj1env1.id,
            key=self.key1,
        )

    def test_get_or_create_tag_key(self):
        pass

    def test_create_tag_value(self):
        pass

    def test_get_or_create_tag_value(self):
        pass

    def test_create_group_tag_key(self):
        pass

    def test_get_or_create_group_tag_key(self):
        pass

    def test_create_group_tag_value(self):
        pass

    def test_get_or_create_group_tag_value(self):
        pass

    def test_create_event_tags(self):
        pass

    def test_get_tag_key(self):
        pass

    def test_get_tag_keys(self):
        pass

    def test_get_tag_value(self):
        pass

    def test_get_tag_values(self):
        pass

    def test_get_group_tag_key(self):
        pass

    def test_get_group_tag_keys(self):
        pass

    def test_get_group_tag_value(self):
        pass

    def test_get_group_tag_values(self):
        pass

    def test_delete_tag_key(self):
        pass

    def test_delete_all_group_tag_keys(self):
        pass

    def test_delete_all_group_tag_values(self):
        pass
