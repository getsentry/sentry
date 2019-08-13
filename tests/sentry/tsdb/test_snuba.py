from __future__ import absolute_import

import copy
from datetime import timedelta
from django.utils import timezone
from mock import patch

from sentry.testutils import TestCase, SnubaTestCase
from sentry.testutils.factories import DEFAULT_EVENT_DATA
from sentry.tsdb.snuba import SnubaTSDB
from sentry.tsdb.base import TSDBModel


class SnubaTSDBTest(TestCase, SnubaTestCase):
    @patch('sentry.tsdb.snuba.BATCH_SIZE_TO_SNUBA', 1)
    def test_paginates_and_reassumbles_result(self):
        self.login_as(user=self.user)

        now = timezone.now()
        min_ago = (now - timedelta(minutes=1)).isoformat()[:19]
        two_min_ago = now - timedelta(minutes=2)

        event1 = self.store_event(
            data={
                'event_id': 'a' * 32,
                'message': 'message',
                'timestamp': min_ago,
                'stacktrace': copy.deepcopy(DEFAULT_EVENT_DATA['stacktrace']),
                'fingerprint': ['group-1']
            },
            project_id=self.project.id,
        )

        event2 = self.store_event(
            data={
                'event_id': 'b' * 32,
                'message': 'message',
                'timestamp': min_ago,
                'stacktrace': copy.deepcopy(DEFAULT_EVENT_DATA['stacktrace']),
                'fingerprint': ['group-2']
            },
            project_id=self.project.id,
        )

        db = SnubaTSDB()

        expected = {event1.group_id: 1, event2.group_id: 1}

        # try with a set
        assert expected == db.get_data(
            TSDBModel.group,
            set([event1.group_id, event2.group_id]),
            two_min_ago,
            now
        )

        # try with an array
        assert expected == db.get_data(
            TSDBModel.group,
            [event1.group_id, event2.group_id],
            two_min_ago,
            now
        )
