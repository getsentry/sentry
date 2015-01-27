"""
sentry.models.grouprulestatus
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from django.db import models
from django.utils import timezone

from sentry.constants import STATUS_ACTIVE
from sentry.db.models import Model, sane_repr


class GroupRuleStatus(Model):
    project = models.ForeignKey('sentry.Project')
    rule = models.ForeignKey('sentry.Rule')
    group = models.ForeignKey('sentry.Group')
    status = models.PositiveSmallIntegerField(default=STATUS_ACTIVE)
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'sentry_grouprulestatus'
        app_label = 'sentry'
        unique_together = (('rule', 'group'),)

    __repr__ = sane_repr('rule_id', 'group_id', 'status')
