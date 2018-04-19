from __future__ import absolute_import

import calendar
from datetime import datetime, timedelta
import json
import pytz
import requests
import six

from sentry.models import GroupHash, Release
from sentry.tsdb.base import TSDBModel
from sentry.tsdb.snuba import SnubaTSDB
from sentry.testutils import TestCase
from sentry.utils import snuba
from sentry.utils.dates import to_timestamp


def timestamp(d):
    t = int(to_timestamp(d))
    return t - (t % 3600)


class SnubaTSDBTest(TestCase):
    def setUp(self):
        assert requests.post(snuba.SNUBA + '/tests/drop').status_code == 200

        self.db = SnubaTSDB()
        self.now = datetime.utcnow().replace(microsecond=0, minute=0, tzinfo=pytz.UTC) - timedelta(hours=4)

        self.proj1 = self.create_project()
        self.proj1env1 = self.create_environment(project=self.proj1, name='test')

        self.proj1group1 = self.create_group(self.proj1)
        self.proj1group2 = self.create_group(self.proj1)

        hash1 = '1' * 32
        hash2 = '2' * 32
        GroupHash.objects.create(project=self.proj1, group=self.proj1group1, hash=hash1)
        GroupHash.objects.create(project=self.proj1, group=self.proj1group2, hash=hash2)

        self.release = Release.objects.create(
            organization_id=self.organization.id,
            version=1,
            date_added=self.now,
        )
        self.release.add_project(self.proj1)

        data = json.dumps([{
            'event_id': (six.text_type(r) * 32)[:32],
            'primary_hash': [hash1, hash2][(r // 600) % 2],
            'project_id': self.proj1.id,
            'message': 'message 1',
            'platform': 'python',
            'datetime': (self.now + timedelta(seconds=r)).strftime('%Y-%m-%dT%H:%M:%S.%fZ'),
            'data': {
                'received': calendar.timegm(self.now.timetuple()) + r,
                'tags': {
                    'foo': 'bar',
                    'baz': 'quux',
                    'environment': self.proj1env1.name,
                    'sentry:release': r // 3600,
                },
                'sentry.interfaces.User': {
                    'id': "user{}".format(r),
                    'email': "user{}@sentry.io".format(r)
                }
            },
        } for r in range(0, 14400, 600)])  # Every 10 min for 4 hours

        assert requests.post(snuba.SNUBA + '/tests/insert', data=data).status_code == 200

    def test_groups(self):
        dts = [self.now + timedelta(hours=i) for i in range(4)]
        assert self.db.get_range(
            TSDBModel.group,
            [self.proj1group1.id],
            dts[0], dts[-1]
        ) == {
            1: [
                (timestamp(dts[0]), 3),
                (timestamp(dts[1]), 3),
                (timestamp(dts[2]), 3),
                (timestamp(dts[3]), 3),
            ],
        }

        assert self.db.get_range(
            TSDBModel.group,
            [self.proj1group1.id, self.proj1group2.id],
            dts[0], dts[-1]
        ) == {
            1: [
                (timestamp(dts[0]), 3),
                (timestamp(dts[1]), 3),
                (timestamp(dts[2]), 3),
                (timestamp(dts[3]), 3),
            ],
            2: [
                (timestamp(dts[0]), 3),
                (timestamp(dts[1]), 3),
                (timestamp(dts[2]), 3),
                (timestamp(dts[3]), 3),
            ],
        }

    def test_releases(self):
        dts = [self.now + timedelta(hours=i) for i in range(4)]
        assert self.db.get_range(
            TSDBModel.release,
            [self.release.id],
            dts[0], dts[-1]
        ) == {
            self.release.id: [
                (timestamp(dts[1]), 6),
            ]
        }
