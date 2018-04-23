from __future__ import absolute_import

from datetime import datetime, timedelta
import requests
import json
import time

from django.conf import settings

from sentry.testutils import TestCase
from sentry.utils import snuba


class SnubaTest(TestCase):
    def setUp(self):
        super(SnubaTest, self).setup()

        r = requests.post(settings.SENTRY_SNUBA + '/tests/drop')
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

        r = requests.post(settings.SENTRY_SNUBA + '/tests/insert', data=json.dumps(events))
        assert r.status_code == 200

        r = snuba.query(
            start=now - timedelta(days=1),
            end=now + timedelta(days=1),
            groupby=['project_id'],
            filter_keys={'project_id': [1]},
        )
        assert r == {1: 1}
