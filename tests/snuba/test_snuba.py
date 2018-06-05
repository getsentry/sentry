from __future__ import absolute_import

from datetime import datetime, timedelta
from mock import patch
import pytest
import pytz
import time
import uuid

from sentry.models import GroupHash, GroupHashTombstone
from sentry.testutils import SnubaTestCase
from sentry.utils import snuba


class SnubaTest(SnubaTestCase):
    def test(self):
        "This is just a simple 'hello, world' example test."

        now = datetime.now()

        events = [{
            'event_id': 'x' * 32,
            'primary_hash': '1' * 32,
            'project_id': 100,
            'message': 'message',
            'platform': 'python',
            'datetime': now.strftime('%Y-%m-%dT%H:%M:%S.%fZ'),
            'data': {
                'received': time.mktime(now.timetuple()),
            }
        }]

        self.snuba_insert(events)

        assert snuba.query(
            start=now - timedelta(days=1),
            end=now + timedelta(days=1),
            groupby=['project_id'],
            filter_keys={'project_id': [100]},
        ) == {100: 1}

    def test_fail(self):
        now = datetime.now()
        with pytest.raises(snuba.SnubaError):
            snuba.query(
                start=now - timedelta(days=1),
                end=now + timedelta(days=1),
                filter_keys={'project_id': [100]},
                groupby=[")("],
            )

    @patch('django.utils.timezone.now')
    def test_project_issues_with_tombstones(self, mock_time):
        now = datetime(2018, 1, 1, 0, 0, 0, tzinfo=pytz.utc)
        mock_time.return_value = now
        a_hash = 'a' * 32

        def _insert_event_for_time(ts):
            self.snuba_insert({
                'event_id': uuid.uuid4().hex,
                'primary_hash': a_hash,
                'project_id': 100,
                'message': 'message',
                'platform': 'python',
                'datetime': ts.strftime('%Y-%m-%dT%H:%M:%S.%fZ'),
                'data': {
                    'received': time.mktime(ts.timetuple()),
                }
            })

        def _query_for_issue(group_id):
            return snuba.query(
                start=now - timedelta(days=1),
                end=now + timedelta(days=1),
                groupby=['issue'],
                filter_keys={
                    'project_id': [100],
                    'issue': [group_id]
                },
            )

        group1 = self.create_group()
        group2 = self.create_group()

        gh1 = GroupHash.objects.create(
            project=self.project,
            group=group1,
            hash=a_hash)
        assert snuba.get_project_issues([self.project], [group1.id]) == \
            [(group1.id, [('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', None)])]

        # 1 event in the groups, no deletes have happened
        _insert_event_for_time(now)
        assert _query_for_issue(group1.id) == {group1.id: 1}

        # group is deleted and then returns (as a new group with the same hash)
        GroupHashTombstone.tombstone_groups(self.project.id, [group1.id])
        gh2 = GroupHash.objects.create(
            project=self.project,
            group=group2,
            hash=a_hash,
        )

        # tombstone time is returned as expected
        assert snuba.get_project_issues([self.project], [group2.id]) == \
            [(group2.id, [('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', '2018-01-01 00:00:00')])]

        # events <= to the tombstone date aren't returned
        _insert_event_for_time(now)
        assert _query_for_issue(group2.id) == {}

        # only the event > than the tombstone date is returned
        _insert_event_for_time(now + timedelta(seconds=1))
        assert _query_for_issue(group2.id) == {group2.id: 1}

        for x in [group1, group2, gh1, gh2]:
            x.delete()
