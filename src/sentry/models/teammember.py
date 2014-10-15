"""
sentry.models.teammember
~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

from django.conf import settings
from django.db import models
from django.utils import timezone

from sentry.constants import MEMBER_TYPES, MEMBER_USER
from sentry.db.models import Model, BoundedIntegerField, BaseManager, sane_repr


class TeamMember(Model):
    """
    Identifies relationships between teams and users.

    Users listed as team members are considered to have access to all projects
    and could be thought of as team owners (though their access level may not)
    be set to ownership.
    """
    team = models.ForeignKey('sentry.Team', related_name="member_set")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="sentry_teammember_set")
    type = BoundedIntegerField(choices=MEMBER_TYPES, default=MEMBER_USER)
    date_added = models.DateTimeField(default=timezone.now)

    objects = BaseManager()

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_teammember'
        unique_together = (('team', 'user'),)

    __repr__ = sane_repr('team_id', 'user_id', 'type')
