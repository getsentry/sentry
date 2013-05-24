"""
sentry.tsdb.manager
~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from django.db.models import F
from django.utils import timezone

from sentry.manager import BaseManager
from sentry.utils.models import create_or_update

from .utils import Rollup


def get_optimal_rollup(start_timestamp, end_timestamp):
    choices = [g for g, _ in reversed(Rollup.get_choices())]

    # calculate the highest rollup within time range
    for idx, c_rollup in enumerate(choices):
        start_norm = Rollup.normalize_to_epoch(c_rollup, start_timestamp)
        end_norm = Rollup.normalize_to_epoch(c_rollup, end_timestamp)
        if start_norm != end_norm:
            try:
                return choices[idx + 1]
            except IndexError:
                return c_rollup
    return None


class PointManager(BaseManager):
    def fetch(self, key, start, end, rollup=None):
        """
        Return a list of points for ``key`` between ``start`` and ``end``.

        If ``rollup`` is ommitted an optimal rollup is used to
        minimize the number of data points returned.

        >>> points = Point.objects.fetch(key, now, now - timedelta(days=7))
        >>> for epoch, value in points:
        >>>     print epoch, value
        """
        rollup = get_optimal_rollup(start, end)
        return sorted(self.filter(
            key=key,
            rollup=rollup,
            epoch__gte=start.strftime('%s'),
            epoch__lte=end.strftime('%s'),
        ).values_list('epoch', 'value'), key=lambda x: x[0])

    def incr(self, key, amount=1, timestamp=None):
        """
        Increments all granularities for ``key`` by ``amount``.
        """
        if timestamp is None:
            timestamp = timezone.now()
        for rollup, _ in Rollup.get_choices():
            epoch = Rollup.normalize_to_epoch(rollup, timestamp)

            create_or_update(
                model=self.model,
                key=key,
                epoch=epoch,
                rollup=rollup,
                defaults={
                    'value': F('value') + amount,
                }
            )

    def trim(self, timestamp=None):
        """
        Called periodically to flush the out of bounds points from the
        database.
        """
        if timestamp is None:
            timestamp = timezone.now()
        for rollup, _ in Rollup.get_choices():
            min_timestamp = Rollup.get_min_timestamp(rollup, timestamp)
            if min_timestamp is None:
                continue

            self.filter(
                rollup=rollup,
                epoch__lt=min_timestamp,
            ).delete()
