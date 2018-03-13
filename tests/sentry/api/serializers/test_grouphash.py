from __future__ import absolute_import

from sentry.api.serializers import serialize
from sentry.models import Event, GroupHash
from sentry.testutils import TestCase


class GroupHashSerializerTest(TestCase):
    def test_no_latest_event(self):
        user = self.create_user()
        group = self.create_group()
        hash = GroupHash.objects.create(
            project=group.project,
            group=group,
            hash='xyz',
        )

        result = serialize(hash, user=user)
        assert result['latestEvent'] is None

    def test_missing_latest_event(self):
        user = self.create_user()
        group = self.create_group()
        hash = GroupHash.objects.create(
            project=group.project,
            group=group,
            hash='xyz',
        )

        GroupHash.record_last_processed_event_id(
            hash.id,
            ['invalid'],
        )

        result = serialize(hash, user=user)
        assert result['latestEvent'] is None

    def test_mismatched_latest_event(self):
        user = self.create_user()
        group = self.create_group()
        hash = GroupHash.objects.create(
            project=group.project,
            group=group,
            hash='xyz',
        )
        event = self.create_event(group=self.create_group())

        GroupHash.record_last_processed_event_id(
            hash.id,
            event.event_id,
        )

        result = serialize(hash, user=user)
        assert result['latestEvent'] is None

    def test_valid_latest_event(self):
        user = self.create_user()
        group = self.create_group()
        hash = GroupHash.objects.create(
            project=group.project,
            group=group,
            hash='xyz',
        )
        event = Event.objects.get(id=self.create_event(group=group).id)

        GroupHash.record_last_processed_event_id(
            hash.id,
            event.event_id,
        )

        result = serialize(hash, user=user)
        assert result['latestEvent'] == serialize(event, user=user)
