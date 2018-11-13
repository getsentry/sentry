from __future__ import absolute_import

from datetime import datetime, timedelta
import pytest
import time
import uuid

from sentry import options
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

    def test_project_issues_with_legacy_hash(self):
        a_hash = 'a' * 32

        for h in [a_hash, 'A' * 8]:
            GroupHash.objects.create(
                project=self.project,
                group=self.group,
                hash=h,
            )

        assert snuba.get_project_issues([self.project], [self.group.id]) == \
            [(self.group.id, self.group.project_id, [('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', None)])]

        # GroupHash without a group_id, should not be included in get_project_issues
        GroupHash.objects.create(
            project=self.project,
            hash='0' * 32,
        )

        group_ids = [i[0] for i in (snuba.get_project_issues([self.project]))]
        assert self.group.id in group_ids
        assert None not in group_ids

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

    def test_project_issues_with_tombstones(self):
        # Nothing to be done if we're using `group_id`.
        # When this option is the default we can remove
        # this test.
        if options.get('snuba.use_group_id_column'):
            return

        base_time = datetime.utcnow()
        hash = 'a' * 32

        def _query_for_issue(group_id):
            return snuba.query(
                start=base_time - timedelta(days=1),
                end=base_time + timedelta(days=1),
                groupby=['issue'],
                filter_keys={
                    'project_id': [self.project.id],
                    'issue': [group_id]
                },
            )

        group1 = self.create_group()
        group2 = self.create_group()

        GroupHash.objects.create(
            project=self.project,
            group=group1,
            hash=hash
        )
        assert snuba.get_project_issues([self.project], [group1.id]) == \
            [(group1.id, group1.project_id, [('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', None)])]

        # 1 event in the groups, no deletes have happened
        self._insert_event_for_time(base_time, hash)
        assert _query_for_issue(group1.id) == {group1.id: 1}

        # group is deleted and then returns (as a new group with the same hash)
        GroupHashTombstone.tombstone_groups(self.project.id, [group1.id])

        ght = GroupHashTombstone.objects.get(project_id=self.project.id)
        assert ght

        GroupHash.objects.create(
            project=self.project,
            group=group2,
            hash=hash,
        )

        # tombstone time is returned as expected
        assert snuba.get_project_issues([self.project], [group2.id]) == \
            [(group2.id, group2.project_id, [('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
                                              ght.deleted_at.strftime("%Y-%m-%d %H:%M:%S"))])]

        # events <= to the tombstone date aren't returned
        self._insert_event_for_time(ght.deleted_at, hash)
        assert _query_for_issue(group2.id) == {}

        # only the event > than the tombstone date is returned
        self._insert_event_for_time(ght.deleted_at + timedelta(seconds=1), hash)
        assert _query_for_issue(group2.id) == {group2.id: 1}

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
