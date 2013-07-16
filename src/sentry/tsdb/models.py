"""
sentry.tsdb.models
~~~~~~~~~~~~~~~~~~

In a generic time-series storage, you might implement
points with a simple key + point storage:

>>> class Key(models.Model):
>>>     name = models.CharField(max_length=1000, unique=True)
>>>
>>>     objects = BaseManager(cache_fields=['name'])
>>>
>>>
>>> class Point(PointBase):
>>>     key = models.ForeignKey(Key)
>>>
>>>     class Meta:
>>>         unique_together = (
>>>             ('key', 'rollup', 'epoch'),
>>>         )

Then you could simple create a key:

>>> key = Key.objects.get_or_create(
>>>     name='events.group.{}'.format(group_id)
>>> )

Increment the key for the current time:

>>> now = timezone.now()
>>> Point.objects.incr(key, timestamp=now)

Periodically flush unused data:

>>> if random.random() > 0.9:
>>>     Point.objects.trim()

Get some datas:

>>> points = Point.objects.fetch(key, now, now - timedelta(days=1))
>>> for (timestamp, value) in points:
>>>     print timestamp, value

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""


from django.db import models

from sentry.models import Project, Group, TagValue
from sentry.utils.models import Model

from .manager import PointManager


class PointBase(Model):
    value = models.PositiveIntegerField(default=0)
    epoch = models.PositiveIntegerField()
    rollup = models.PositiveIntegerField()

    objects = PointManager()

    class Meta:
        abstract = True
        index_together = (
            ('rollup', 'epoch'),
        )


class ProjectPoint(PointBase):
    project = models.ForeignKey(Project)

    class Meta:
        unique_together = (
            ('project', 'rollup', 'epoch'),
        )


class TagPoint(PointBase):
    project = models.ForeignKey(Project)
    tag = models.ForeignKey(TagValue)

    class Meta:
        unique_together = (
            ('tag', 'rollup', 'epoch'),
        )


class GroupPoint(PointBase):
    project = models.ForeignKey(Project)
    group = models.ForeignKey(Group)

    class Meta:
        unique_together = (
            ('group', 'rollup', 'epoch'),
        )


class GroupTagPoint(PointBase):
    project = models.ForeignKey(Project)
    group = models.ForeignKey(Group)
    tag = models.ForeignKey(TagValue)

    class Meta:
        unique_together = (
            ('group', 'tag', 'rollup', 'epoch'),
        )
