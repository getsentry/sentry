from __future__ import absolute_import

from datetime import datetime, timedelta
import pytest
import time
import uuid

from sentry.testutils import SnubaTestCase, TestCase
from sentry.utils import snuba


class SnubaTest(TestCase, SnubaTestCase):
    def _insert_event_for_time(self, ts, hash='a' * 32, group_id=None):
        self.snuba_insert({
            'event_id': uuid.uuid4().hex,
            'primary_hash': hash,
            'group_id': group_id if group_id else int(hash[:16], 16),
            'project_id': self.project.id,
            'message': 'message',
            'platform': 'python',
            'datetime': ts.strftime('%Y-%m-%dT%H:%M:%S.%fZ'),
            'data': {
                'received': time.mktime(ts.timetuple()),
            }
        })

    def test(self):
        "This is just a simple 'hello, world' example test."

        now = datetime.now()

        events = [{
            'event_id': 'x' * 32,
            'primary_hash': '1' * 32,
            'group_id': 1,
            'project_id': self.project.id,
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
            filter_keys={'project_id': [self.project.id]},
        ) == {self.project.id: 1}

    def test_fail(self):
        now = datetime.now()
        with pytest.raises(snuba.SnubaError):
            snuba.query(
                start=now - timedelta(days=1),
                end=now + timedelta(days=1),
                filter_keys={'project_id': [self.project.id]},
                groupby=[")("],
            )

    def test_organization_retention_respected(self):
        base_time = datetime.utcnow()

        self._insert_event_for_time(base_time - timedelta(minutes=1))
        self._insert_event_for_time(base_time - timedelta(days=2))

        def _get_event_count():
            # attempt to query back 90 days
            return snuba.query(
                start=base_time - timedelta(days=90),
                end=base_time + timedelta(days=1),
                groupby=['project_id'],
                filter_keys={
                    'project_id': [self.project.id],
                },
            )

        assert _get_event_count() == {self.project.id: 2}
        with self.options({'system.event-retention-days': 1}):
            assert _get_event_count() == {self.project.id: 1}

    def test_organization_retention_larger_than_end_date(self):
        base_time = datetime.utcnow()

        with self.options({'system.event-retention-days': 1}):
            assert snuba.query(
                start=base_time - timedelta(days=90),
                end=base_time - timedelta(days=60),
                groupby=['project_id'],
                filter_keys={
                    'project_id': [self.project.id],
                },
            ) == {}

    def test_use_group_id(self):
        base_time = datetime.utcnow()
        group = self.create_group()
        self._insert_event_for_time(base_time, group_id=group.id)

        with self.options({'snuba.use_group_id_column': True}):
            # verify filter_keys and aggregation
            assert snuba.query(
                start=base_time - timedelta(days=1),
                end=base_time + timedelta(days=1),
                groupby=['issue'],
                filter_keys={
                    'project_id': [self.project.id],
                    'issue': [group.id]
                },
            ) == {group.id: 1}

            # verify raw_query selecting issue row
            assert snuba.raw_query(
                start=base_time - timedelta(days=1),
                end=base_time + timedelta(days=1),
                selected_columns=['issue', 'timestamp'],
                filter_keys={
                    'project_id': [self.project.id],
                    'issue': [group.id]
                },
            )['data'] == [{
                'issue': group.id,
                'timestamp': base_time.strftime('%Y-%m-%dT%H:%M:%S+00:00'),
            }]
