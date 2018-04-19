"""
sentry.tagstore.v2.models.eventtag
~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2017 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from django.db import models, router, connections
from django.utils import timezone

from sentry.db.models import (Model, BoundedBigIntegerField, FlexibleForeignKey, sane_repr)


class EventTag(Model):
    __core__ = False

    project_id = BoundedBigIntegerField()
    group_id = BoundedBigIntegerField()
    event_id = BoundedBigIntegerField()
    key = FlexibleForeignKey('tagstore.TagKey', db_column='key_id')
    value = FlexibleForeignKey('tagstore.TagValue', db_column='value_id')
    date_added = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        app_label = 'tagstore'
        unique_together = (('project_id', 'event_id', 'key', 'value'), )
        index_together = (
            ('project_id', 'key', 'value'),
            ('group_id', 'key', 'value'),
        )

    __repr__ = sane_repr('event_id', 'key_id', 'value_id')

    def delete(self):
        using = router.db_for_read(EventTag)
        cursor = connections[using].cursor()
        cursor.execute(
            """
            DELETE FROM tagstore_eventtag
            WHERE project_id = %s
              AND id = %s
        """, [self.project_id, self.id]
        )
