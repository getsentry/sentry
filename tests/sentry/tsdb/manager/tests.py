import pytz

from datetime import datetime, timedelta
from exam import fixture

from django.db import models

from sentry.testutils import TestCase
from sentry.tsdb.models import PointBase
from sentry.tsdb.utils import ROLLUPS

timestamp = datetime(2013, 5, 18, 15, 13, 58, 132928, tzinfo=pytz.UTC)


class Key(models.Model):
    name = models.CharField(max_length=1000, unique=True)


class Point(PointBase):
    key = models.ForeignKey(Key)

    class Meta:
        unique_together = (
            ('key', 'rollup', 'epoch'),
        )


class IncrTest(TestCase):
    @fixture
    def key(self):
        return Key.objects.create(name='test')

    def test_simple(self):
        Point.objects.incr(self.key, timestamp=timestamp)

        points = list(Point.objects.filter(key=self.key))

        assert len(points) == len(ROLLUPS)
        for point in points:
            assert point.value == 1


class TrimTest(TestCase):
    @fixture
    def key(self):
        return Key.objects.create(name='test')

    def test_simple(self):
        rollup, samples = ROLLUPS[0]

        Point.objects.create(
            key=self.key,
            rollup=rollup,
            value=1,
            epoch=(timestamp - timedelta(seconds=rollup * samples * 2)).strftime('%s'),
        )

        Point.objects.trim(timestamp=timestamp)

        assert not Point.objects.exists()


class FetchTest(TestCase):
    @fixture
    def key(self):
        return Key.objects.create(name='test')

    def test_simple(self):
        rollup = ROLLUPS[0][0]

        Point.objects.create(
            key=self.key,
            rollup=rollup,
            value=1,
            epoch=timestamp.strftime('%s'),
        )
        Point.objects.create(
            key=self.key,
            rollup=rollup,
            value=1,
            epoch=(timestamp - timedelta(seconds=rollup)).strftime('%s'),
        )
        Point.objects.create(
            key=self.key,
            rollup=rollup,
            value=1,
            epoch=(timestamp - timedelta(seconds=rollup * 2)).strftime('%s'),
        )

        points = Point.objects.fetch(
            key=self.key,
            start=timestamp - timedelta(seconds=rollup),
            end=timestamp,
        )
        assert len(points) == 2
