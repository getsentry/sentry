import pytz

from datetime import datetime
from exam import fixture

from sentry.testutils import TestCase
from sentry.tsdb.models import Point, Key
from sentry.tsdb.utils import Granularity

timestamp = datetime(2013, 5, 18, 15, 13, 58, 132928, tzinfo=pytz.UTC)


class IncrTest(TestCase):
    @fixture
    def key(self):
        return Key.objects.create(name='test')

    def test_simple(self):
        Point.objects.incr(self.key, timestamp=timestamp)

        points = list(Point.objects.filter(key=self.key))

        assert len(points) == len(Granularity.get_choices())
        for point in points:
            assert point.value == 1
