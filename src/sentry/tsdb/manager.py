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


class PointManager(BaseManager):
    def fetch(self, key, start_timestamp, end_timestamp):
        # TODO
        raise NotImplementedError

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

    def trim(self):
        """
        Called periodically to flush the out of bounds points from the
        database.
        """
        now = timezone.now()
        for granularity, _ in Granularity.get_choices():
            min_value = Granularity.get_min_value(granularity, now)
            if min_value is None:
                continue

            self.filter(
                granularity=granularity,
                value__lt=min_value,
            ).delete()
