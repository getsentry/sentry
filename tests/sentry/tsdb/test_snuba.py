from __future__ import absolute_import

from datetime import datetime, timedelta
from dateutil.parser import parse as parse_datetime
import pytz

from sentry.testutils import TestCase
from sentry.tsdb.base import TSDBModel
from sentry.tsdb.snuba import SnubaTSDB
from sentry.utils.dates import to_timestamp


class SnubaTSDBTest(TestCase):
    def setUp(self):
        self.db = SnubaTSDB()

    def test_simple(self):

        now = datetime.utcnow().replace(tzinfo=pytz.UTC)
        now = parse_datetime('2018-03-06T07:30:00Z')
        dts = [now + timedelta(hours=i) for i in range(4)]

        def hour_floor(d):
            t = int(to_timestamp(d))
            return t - (t % 3600)

        project_id = 295275
        results = self.db.get_most_frequent(TSDBModel.frequent_issues_by_project, [
                                            project_id], dts[0], dts[-1])

        results = self.db.get_range(TSDBModel.project, [project_id], dts[0], dts[-1])
        assert project_id in results
        assert len(results[project_id]) == len(dts)
        for i, d in enumerate(dts):
            assert results[project_id][i][0] == hour_floor(d)
            # TODO mock the data so we can also validate counts
            assert isinstance(results[project_id][i][1], int)
