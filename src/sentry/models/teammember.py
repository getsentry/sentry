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
from django.utils.translation import ugettext_lazy as _

from sentry.db.models import (
    Model, BoundedIntegerField, BaseManager, FlexibleForeignKey, sane_repr
)


# TODO(dcramer): pull in enum library
class TeamMemberType(object):
    ADMIN = 0
    MEMBER = 50
    BOT = 100


class TeamMember(Model):
    """
    Identifies relationships between teams and users.

    Users listed as team members are considered to have access to all projects
    and could be thought of as team owners (though their access level may not)
    be set to ownership.
    """
    team = FlexibleForeignKey('sentry.Team', related_name=None)
    user = FlexibleForeignKey(settings.AUTH_USER_MODEL, related_name=None)
    type = BoundedIntegerField(choices=(
        (TeamMemberType.MEMBER, _('Member')),
        (TeamMemberType.ADMIN, _('Admin')),
        (TeamMemberType.BOT, _('Bot')),
    ), default=TeamMemberType.MEMBER)
    date_added = models.DateTimeField(default=timezone.now)

    objects = BaseManager()

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_teammember'
        unique_together = (('team', 'user'),)

    __repr__ = sane_repr('team_id', 'user_id', 'type')
