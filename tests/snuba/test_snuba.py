from __future__ import absolute_import

from datetime import datetime, timedelta
import requests
import json
import time

from exam import before

from sentry.testutils import TestCase
from sentry.utils.snuba import query, SNUBA


class SnubaTest(TestCase):
    @before
    def setup(self):
        r = requests.post(SNUBA + '/tests/drop')
        assert r.status_code == 200

    def test(self):
        now = datetime.now()

        events = [{
            'event_id': 'x' * 32,
            'primary_hash': '1' * 32,
            'project_id': 1,
            'message': 'message',
            'platform': 'python',
            'datetime': now.strftime('%Y-%m-%dT%H:%M:%S.%fZ'),
            'data': {
                'received': time.mktime(now.timetuple()),
            }
        }]

        r = requests.post(SNUBA + '/tests/insert', data=json.dumps(events))
        assert r.status_code == 200

        r = query(
            start=now - timedelta(days=1),
            end=now + timedelta(days=1),
            groupby=['project_id'],
            filter_keys={'project_id': [1]},
        )
        assert r == {1: 1}
