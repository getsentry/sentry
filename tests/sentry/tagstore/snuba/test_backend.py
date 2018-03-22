from __future__ import absolute_import

from sentry.models import GroupHash
from sentry.testutils import TestCase
from sentry.tagstore.snuba.backend import SnubaTagStorage


class TagStorage(TestCase):
    def setUp(self):
        self.ts = SnubaTagStorage()

        self.proj1 = self.create_project()

        self.proj1env1 = self.create_environment(project=self.proj1, name='dev')
        self.proj1env2 = self.create_environment(project=self.proj1, name='prod')

        self.proj1group1 = self.create_group(self.proj1)
        self.proj1group2 = self.create_group(self.proj1)

        GroupHash.objects.create(project=self.proj1, group=self.proj1group1, hash='1' * 16)
        GroupHash.objects.create(project=self.proj1, group=self.proj1group2, hash='2' * 16)

    def test_get_group_ids_for_search_filter(self):
        from sentry.search.base import ANY, EMPTY
        tags = {
            'foo': 'bar',
            'baz': 'quux',
        }

        result = self.ts.get_group_ids_for_search_filter(self.proj1.id, self.proj1env1.id, tags)

        tags = {
            'foo': ANY,
            'baz': EMPTY,
        }

        result = self.ts.get_group_ids_for_search_filter(self.proj1.id, self.proj1env1.id, tags)
        assert result is not None
