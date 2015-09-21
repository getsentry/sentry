"""
sentry.models.userreport
~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2015 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from django.db import models
from django.utils import timezone
from django.utils.translation import ugettext_lazy as _

from sentry.db.models import (
    BoundedPositiveIntegerField, FlexibleForeignKey, Model, sane_repr
)


# TODO(dcramer): pull in enum library
class UserReportResolution(object):
    NONE = 0
    AWAITING_RESOLUTION = 1
    NOTIFIED = 2


class UserReport(Model):
    project = FlexibleForeignKey('sentry.Project')
    group = FlexibleForeignKey('sentry.Group', null=True)
    event_id = models.CharField(max_length=32)
    name = models.CharField(max_length=128)
    email = models.EmailField(max_length=75)
    comments = models.TextField()
    resolution = BoundedPositiveIntegerField(default=0, choices=(
        (UserReportResolution.NONE, _('None')),
        (UserReportResolution.AWAITING_RESOLUTION, _('Awaiting Resolution')),
        (UserReportResolution.NOTIFIED, _('Notified')),
    ))
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_userreport'
        index_together = (('project', 'event_id'),)

    __repr__ = sane_repr('event_id', 'name', 'email')
