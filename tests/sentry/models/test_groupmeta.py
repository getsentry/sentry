# -*- coding: utf-8 -*-

from __future__ import absolute_import

from sentry.models import GroupMeta
from sentry.testutils import TestCase


class GroupMetaManagerTest(TestCase):
    def test_set_value(self):
        GroupMeta.objects.set_value(self.group, "foo", "bar")
        assert GroupMeta.objects.filter(group=self.group, key="foo", value="bar").exists()

    def test_get_value(self):
        with self.assertRaises(GroupMeta.CacheNotPopulated):
            GroupMeta.objects.get_value(self.group, "foo")

        GroupMeta.objects.create(group=self.group, key="foo", value="bar")
        with self.assertRaises(GroupMeta.CacheNotPopulated):
            GroupMeta.objects.get_value(self.group, "foo")

        GroupMeta.objects.populate_cache([self.group])
        result = GroupMeta.objects.get_value(self.group, "foo")
        assert result == "bar"

    def test_unset_value(self):
        GroupMeta.objects.unset_value(self.group, "foo")
        GroupMeta.objects.create(group=self.group, key="foo", value="bar")
        GroupMeta.objects.unset_value(self.group, "foo")
        assert not GroupMeta.objects.filter(group=self.group, key="foo").exists()

    def test_get_value_bulk(self):
        with self.assertRaises(GroupMeta.CacheNotPopulated):
            GroupMeta.objects.get_value_bulk([self.group], "foo")

        GroupMeta.objects.create(group=self.group, key="foo", value="bar")
        with self.assertRaises(GroupMeta.CacheNotPopulated):
            GroupMeta.objects.get_value_bulk([self.group], "foo")

        GroupMeta.objects.populate_cache([self.group])
        result = GroupMeta.objects.get_value_bulk([self.group], "foo")
        assert result == {self.group: "bar"}
