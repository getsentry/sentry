# -*- coding: utf-8 -*-

from __future__ import absolute_import, print_function

from datetime import timedelta
from django.utils import timezone

from sentry.models import GroupResolution
from sentry.testutils import TestCase


class GroupResolutionTest(TestCase):
    def setUp(self):
        super(GroupResolutionTest, self).setUp()
        self.old_release = self.create_release(version="a", project=self.project)
        self.old_release.update(date_added=timezone.now() - timedelta(minutes=30))
        self.new_release = self.create_release(version="b", project=self.project)
        self.group = self.create_group()

    def test_in_next_release_with_new_release(self):
        GroupResolution.objects.create(
            release=self.old_release, group=self.group, type=GroupResolution.Type.in_next_release
        )
        assert not GroupResolution.has_resolution(self.group, self.new_release)

    def test_in_next_release_with_same_release(self):
        GroupResolution.objects.create(
            release=self.old_release, group=self.group, type=GroupResolution.Type.in_next_release
        )
        assert GroupResolution.has_resolution(self.group, self.old_release)

    def test_in_next_release_with_old_release(self):
        GroupResolution.objects.create(
            release=self.new_release, group=self.group, type=GroupResolution.Type.in_next_release
        )
        assert GroupResolution.has_resolution(self.group, self.old_release)

    def test_in_release_with_new_release(self):
        GroupResolution.objects.create(
            release=self.old_release, group=self.group, type=GroupResolution.Type.in_release
        )
        assert not GroupResolution.has_resolution(self.group, self.new_release)

    def test_in_release_with_current_release(self):
        GroupResolution.objects.create(
            release=self.old_release, group=self.group, type=GroupResolution.Type.in_release
        )
        assert not GroupResolution.has_resolution(self.group, self.old_release)

    def test_in_release_with_old_release(self):
        GroupResolution.objects.create(
            release=self.new_release, group=self.group, type=GroupResolution.Type.in_release
        )
        assert GroupResolution.has_resolution(self.group, self.old_release)

    def test_no_release_with_resolution(self):
        GroupResolution.objects.create(
            release=self.new_release, group=self.group, type=GroupResolution.Type.in_release
        )
        assert GroupResolution.has_resolution(self.group, None)

    def test_no_release_with_no_resolution(self):
        assert not GroupResolution.has_resolution(self.group, None)
