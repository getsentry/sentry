from __future__ import absolute_import

from sentry.testutils import TestCase
from sentry.tagstore.v2.backend import TagStorage
from sentry.tagstore.v2.models import TagKey, TagValue, GroupTagKey, GroupTagValue, EventTag  # NOQA


class V2TagStorage(TestCase):
    def setUp(self):
        self.ts = TagStorage()

        self.proj1 = self.create_project()
        self.proj1group1 = self.create_group(self.proj1)
        self.proj1group2 = self.create_group(self.proj1)
        self.proj1env1 = self.create_environment(project=self.proj1)
        self.proj1env2 = self.create_environment(project=self.proj1)

        self.proj2 = self.create_project()
        self.proj2group1 = self.create_group(self.proj2)
        self.proj2group2 = self.create_group(self.proj2)
        self.proj2env1 = self.create_environment(project=self.proj2)
        self.proj2env2 = self.create_environment(project=self.proj2)

        self.key1 = 'key1'
        self.key2 = 'key2'

        self.value1 = 'value1'
        self.value2 = 'value2'

    def test_create_tag_key(self):
        self.ts.create_tag_key(
            project_id=self.proj1.id,
            environment_id=self.proj1env1.id,
            key=self.key1,
        )

        assert TagKey.objects.filter(
            project_id=self.proj1.id,
            environment_id=self.proj1env1.id,
            key=self.key1,
        ).count() == 1
        assert TagKey.objects.all().count() == 1

    def test_get_or_create_tag_key(self):
        tk1, _ = self.ts.get_or_create_tag_key(
            project_id=self.proj1.id,
            environment_id=self.proj1env1.id,
            key=self.key1,
        )

        tk2, _ = self.ts.get_or_create_tag_key(
            project_id=self.proj1.id,
            environment_id=self.proj1env1.id,
            key=self.key1,
        )

        assert tk1.id == tk2.id
        assert TagKey.objects.filter(
            project_id=self.proj1.id,
            environment_id=self.proj1env1.id,
            key=self.key1,
        ).count() == 1
        assert TagKey.objects.all().count() == 1

    def test_create_tag_value(self):
        self.ts.create_tag_value(
            project_id=self.proj1.id,
            environment_id=self.proj1env1.id,
            key=self.key1,
            value=self.value1,
        )

        tk = TagKey.objects.get(
            project_id=self.proj1.id,
            environment_id=self.proj1env1.id,
            key=self.key1,
        )
        assert TagKey.objects.all().count() == 1

        assert TagValue.objects.filter(
            project_id=self.proj1.id,
            environment_id=self.proj1env1.id,
            key_id=tk.id,
            value=self.value1,
        ).count() == 1
        assert TagValue.objects.all().count() == 1

    def test_get_or_create_tag_value(self):
        tv1, _ = self.ts.get_or_create_tag_value(
            project_id=self.proj1.id,
            environment_id=self.proj1env1.id,
            key=self.key1,
            value=self.value1,
        )

        tv2, _ = self.ts.get_or_create_tag_value(
            project_id=self.proj1.id,
            environment_id=self.proj1env1.id,
            key=self.key1,
            value=self.value1,
        )

        assert tv1.id == tv2.id

        tk = TagKey.objects.get(
            project_id=self.proj1.id,
            environment_id=self.proj1env1.id,
            key=self.key1,
        )

        assert TagKey.objects.all().count() == 1

        assert TagValue.objects.filter(
            project_id=self.proj1.id,
            environment_id=self.proj1env1.id,
            key_id=tk.id,
            value=self.value1,
        ).count() == 1
        assert TagValue.objects.all().count() == 1

    def test_create_group_tag_key(self):
        self.ts.create_group_tag_key(
            project_id=self.proj1.id,
            group_id=self.proj1group1.id,
            environment_id=self.proj1env1.id,
            key=self.key1,
        )

        tk = TagKey.objects.get(
            project_id=self.proj1.id,
            environment_id=self.proj1env1.id,
            key=self.key1,
        )
        assert TagKey.objects.all().count() == 1

        assert GroupTagKey.objects.filter(
            project_id=self.proj1.id,
            group_id=self.proj1group1.id,
            environment_id=self.proj1env1.id,
            key_id=tk.id,
        ).count() == 1
        assert GroupTagKey.objects.all().count() == 1

    def test_get_or_create_group_tag_key(self):
        gtk1, _ = self.ts.get_or_create_group_tag_key(
            project_id=self.proj1.id,
            group_id=self.proj1group1.id,
            environment_id=self.proj1env1.id,
            key=self.key1,
        )

        gtk2, _ = self.ts.get_or_create_group_tag_key(
            project_id=self.proj1.id,
            group_id=self.proj1group1.id,
            environment_id=self.proj1env1.id,
            key=self.key1,
        )

        assert gtk1.id == gtk2.id

        tk = TagKey.objects.get(
            project_id=self.proj1.id,
            environment_id=self.proj1env1.id,
            key=self.key1,
        )
        assert TagKey.objects.all().count() == 1

        assert GroupTagKey.objects.filter(
            project_id=self.proj1.id,
            group_id=self.proj1group1.id,
            environment_id=self.proj1env1.id,
            key_id=tk.id,
        ).count() == 1
        assert GroupTagKey.objects.all().count() == 1

    def test_create_group_tag_value(self):
        self.ts.create_group_tag_value(
            project_id=self.proj1.id,
            group_id=self.proj1group1.id,
            environment_id=self.proj1env1.id,
            key=self.key1,
            value=self.value1,
        )

        tk = TagKey.objects.get(
            project_id=self.proj1.id,
            environment_id=self.proj1env1.id,
            key=self.key1,
        )
        assert TagKey.objects.all().count() == 1

        tv = TagValue.objects.get(
            project_id=self.proj1.id,
            environment_id=self.proj1env1.id,
            key_id=tk.id,
            value=self.value1,
        )
        assert TagValue.objects.all().count() == 1

        assert GroupTagValue.objects.filter(
            project_id=self.proj1.id,
            group_id=self.proj1group1.id,
            environment_id=self.proj1env1.id,
            key_id=tk.id,
            value_id=tv.id,
        ).count() == 1
        assert GroupTagValue.objects.all().count() == 1

    def test_get_or_create_group_tag_value(self):
        gtv1, _ = self.ts.get_or_create_group_tag_value(
            project_id=self.proj1.id,
            group_id=self.proj1group1.id,
            environment_id=self.proj1env1.id,
            key=self.key1,
            value=self.value1,
        )

        gtv2, _ = self.ts.get_or_create_group_tag_value(
            project_id=self.proj1.id,
            group_id=self.proj1group1.id,
            environment_id=self.proj1env1.id,
            key=self.key1,
            value=self.value1,
        )

        assert gtv1.id == gtv2.id

        tk = TagKey.objects.get(
            project_id=self.proj1.id,
            environment_id=self.proj1env1.id,
            key=self.key1,
        )
        assert TagKey.objects.all().count() == 1

        tv = TagValue.objects.get(
            project_id=self.proj1.id,
            environment_id=self.proj1env1.id,
            key_id=tk.id,
            value=self.value1,
        )
        assert TagValue.objects.all().count() == 1

        assert GroupTagValue.objects.filter(
            project_id=self.proj1.id,
            group_id=self.proj1group1.id,
            environment_id=self.proj1env1.id,
            key_id=tk.id,
            value_id=tv.id,
        ).count() == 1
        assert GroupTagValue.objects.all().count() == 1

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
