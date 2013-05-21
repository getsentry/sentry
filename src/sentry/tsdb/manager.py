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

from .utils import Granularity


def get_optimal_granularity(start_timestamp, end_timestamp):
    choices = [g for g, _ in reversed(Granularity.get_choices())]

    # calculate the highest granularity within time range
    for idx, c_granularity in enumerate(choices):
        start_norm = Granularity.normalize_to_epoch(c_granularity, start_timestamp)
        end_norm = Granularity.normalize_to_epoch(c_granularity, end_timestamp)
        if start_norm != end_norm:
            try:
                return choices[idx + 1]
            except IndexError:
                return c_granularity
    return None


class PointManager(BaseManager):
    def fetch(self, key, start, end, granularity=None):
        """
        Return a list of points for ``key`` between ``start`` and ``end``.

        If ``granularity`` is ommitted an optimal granularity is used to
        minimize the number of data points returned.

        >>> points = Point.objects.fetch(key, now, now - timedelta(days=7))
        >>> for epoch, value in points:
        >>>     print epoch, value
        """
        granularity = get_optimal_granularity(start, end)
        return sorted(self.filter(
            key=key,
            granularity=granularity,
            epoch__gte=start.strftime('%s'),
            epoch__lte=end.strftime('%s'),
        ).values_list('epoch', 'value'), key=lambda x: x[0])

    def incr(self, key, amount=1, timestamp=None):
        """
        Increments all granularities for ``key`` by ``amount``.
        """
        if timestamp is None:
            timestamp = timezone.now()
        for granularity, _ in Granularity.get_choices():
            epoch = Granularity.normalize_to_epoch(granularity, timestamp)

            create_or_update(
                model=self.model,
                key=key,
                epoch=epoch,
                granularity=granularity,
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
        for granularity, _ in Granularity.get_choices():
            min_value = Granularity.get_min_timestamp(granularity, timestamp)
            if min_value is None:
                continue

            self.filter(
                granularity=granularity,
                value__lt=min_value,
            ).delete()
