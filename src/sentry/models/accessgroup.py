"""
sentry.models.accessgroup
~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from django.conf import settings
from django.db import models
from django.utils import timezone

from sentry.constants import MEMBER_TYPES, MEMBER_USER
from sentry.db.models import (
    Model, BoundedIntegerField, FlexibleForeignKey, GzippedDictField,
    BaseManager, sane_repr
)


class AccessGroup(Model):
    """
    An access group identifies a set of members with a defined set
    of permissions (and project access) for a Team.

    Groups may be automated through extensions (such as LDAP) so that
    membership is automatically maintained. If this is the case the
    ``managed`` attribute will be ``True``.
    """
    team = FlexibleForeignKey('sentry.Team')
    name = models.CharField(max_length=64)
    type = BoundedIntegerField(choices=MEMBER_TYPES, default=MEMBER_USER)
    managed = models.BooleanField(default=False)
    data = GzippedDictField(blank=True, null=True)
    date_added = models.DateTimeField(default=timezone.now)

    projects = models.ManyToManyField('sentry.Project')
    members = models.ManyToManyField(settings.AUTH_USER_MODEL)

    objects = BaseManager()

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_accessgroup'
        unique_together = (('team', 'name'),)

    __repr__ = sane_repr('team_id', 'name', 'type', 'managed')
