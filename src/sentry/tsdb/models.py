"""
sentry.tsdb.models
~~~~~~~~~~~~~~~~~~

Get a key:

>>> key = Key.objects.get_or_create(
>>>     name='events.group.{}'.format(group_id)
>>> )

Increment the key for the current time:

>>> now = timezone.now()
>>> Point.objects.incr(key, timestamp=now)

Periodically flush unused data:

>>> if random.random() > 0.9:
>>>     Point.objects.trim()


:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""


from django.db import models

from sentry.manager import BaseManager

from .manager import PointManager
from .utils import Granularity


class Key(models.Model):
    name = models.CharField(max_length=1000, unique=True)
    label = models.CharField(max_length=1000, null=True)

    objects = BaseManager(cache_fields=['name'])


class Point(models.Model):
    key = models.ForeignKey(Key)
    value = models.PositiveIntegerField(default=0)
    epoch = models.PositiveIntegerField()
    granularity = models.PositiveIntegerField(choices=Granularity.get_choices())

    objects = PointManager()

    class Meta:
        index_together = (
            ('key', 'granularity', 'value'),
            ('granularity', 'value'),
        )
