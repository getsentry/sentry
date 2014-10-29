"""
sentry.models.eventfiltertagvalue
~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from django.db import models

from sentry.db.models import Model, sane_repr, BaseManager


class EventFilterTagValue(Model):
    """
    Links messages in message table, with grouptagvalue in sentry_messagevalue
    table.
    """

    # event in this case is the id from sentry_message table,
    # not to confuse with message_id that is the same as event_id
    # from sentry_eventmapping table!
    event = models.ForeignKey('sentry.Event')
    group = models.ForeignKey('sentry.Group', db_index=True)
    grouptagvalue = models.ForeignKey('sentry.GroupTagValue')

    objects = BaseManager()

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_eventfiltertagvalue'
        unique_together = (('event', 'group', 'grouptagvalue'),)

    __repr__ = sane_repr('group_id', 'event_id', 'grouptagvalue_id')

EventFilter = EventFilterTagValue
