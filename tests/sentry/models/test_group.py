from __future__ import absolute_import

import six

from datetime import datetime, timedelta

import pytest
from django.db.models import ProtectedError
from django.utils import timezone

from sentry.models import (
    Group, GroupRedirect, GroupSnooze, GroupStatus, Release,
    get_group_with_redirect
)
from sentry.testutils import TestCase


class GroupTest(TestCase):
    def test_is_resolved(self):
        group = self.create_group(status=GroupStatus.RESOLVED)
        assert group.is_resolved()

        group.status = GroupStatus.IGNORED
        assert not group.is_resolved()

        group.status = GroupStatus.UNRESOLVED
        assert not group.is_resolved()

        group.last_seen = timezone.now() - timedelta(hours=12)

        group.project.update_option('sentry:resolve_age', 24)

        assert not group.is_resolved()

        group.project.update_option('sentry:resolve_age', 1)

        assert group.is_resolved()

    def test_get_oldest_latest_event_no_events(self):
        group = self.create_group()
        assert group.get_latest_event() is None
        assert group.get_oldest_event() is None

    def test_get_oldest_latest_events(self):
        group = self.create_group()
        for i in range(0, 3):
            self.create_event(
                event_id=six.text_type(i),
                group=group,
                datetime=datetime(2013, 8, 13, 3, 8, i),
            )

        assert group.get_latest_event().event_id == '2'
        assert group.get_oldest_event().event_id == '0'

    def test_get_oldest_latest_identical_timestamps(self):
        group = self.create_group()
        for i in range(0, 3):
            self.create_event(
                event_id=six.text_type(i),
                group=group,
                datetime=datetime(2013, 8, 13, 3, 8, 50),
            )

        assert group.get_latest_event().event_id == '2'
        assert group.get_oldest_event().event_id == '0'

    def test_get_oldest_latest_almost_identical_timestamps(self):
        group = self.create_group()
        self.create_event(
            event_id='0',
            group=group,
            datetime=datetime(2013, 8, 13, 3, 8, 0),  # earliest
        )
        for i in range(1, 3):
            self.create_event(
                event_id=six.text_type(i),
                group=group,
                datetime=datetime(2013, 8, 13, 3, 8, 30),  # all in the middle
            )
        self.create_event(
            event_id='3',
            group=group,
            datetime=datetime(2013, 8, 13, 3, 8, 59),  # latest
        )

        assert group.get_latest_event().event_id == '3'
        assert group.get_oldest_event().event_id == '0'

    def test_is_ignored_with_expired_snooze(self):
        group = self.create_group(
            status=GroupStatus.IGNORED,
        )
        GroupSnooze.objects.create(
            group=group,
            until=timezone.now() - timedelta(minutes=1),
        )
        assert not group.is_ignored()

    def test_status_with_expired_snooze(self):
        group = self.create_group(
            status=GroupStatus.IGNORED,
        )
        GroupSnooze.objects.create(
            group=group,
            until=timezone.now() - timedelta(minutes=1),
        )
        assert group.get_status() == GroupStatus.UNRESOLVED

    def test_deleting_release_does_not_delete_group(self):
        project = self.create_project()
        release = Release.objects.create(
            version='a',
            project=project,
        )
        group = self.create_group(
            project=project,
            first_release=release,
        )

        with pytest.raises(ProtectedError):
            release.delete()

        group = Group.objects.get(id=group.id)
        assert group.first_release == release

    def test_save_truncate_message(self):
        assert len(self.create_group(message='x' * 300).message) == 255
        assert self.create_group(message='\nfoo\n   ').message == 'foo'
        assert self.create_group(message='foo').message == 'foo'
        assert self.create_group(message='').message == ''

    def test_get_group_with_redirect(self):
        group = self.create_group()
        assert get_group_with_redirect(group.id) == (group, False)

        duplicate_id = self.create_group().id
        Group.objects.filter(id=duplicate_id).delete()
        GroupRedirect.objects.create(
            group_id=group.id,
            previous_group_id=duplicate_id,
        )

        assert get_group_with_redirect(duplicate_id) == (group, True)

        # We shouldn't end up in a case where the redirect points to a bad
        # reference, but testing this path for completeness.
        group.delete()

        with pytest.raises(Group.DoesNotExist):
            get_group_with_redirect(duplicate_id)

    def test_invalid_shared_id(self):
        with pytest.raises(Group.DoesNotExist):
            Group.from_share_id('adc7a5b902184ce3818046302e94f8ec')
