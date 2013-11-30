"""
sentry.models.pendingteammember
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

import logging

from hashlib import md5

from django.conf import settings
from django.core.urlresolvers import reverse
from django.db import models
from django.utils import timezone

from sentry.constants import MEMBER_TYPES, MEMBER_USER
from sentry.db.models import (
    Model, BoundedIntegerField, BaseManager, sane_repr
)
from sentry.utils.http import absolute_uri


class PendingTeamMember(Model):
    """
    Identifies relationships between teams and pending invites.
    """
    team = models.ForeignKey('sentry.Team', related_name="pending_member_set")
    email = models.EmailField()
    type = BoundedIntegerField(choices=MEMBER_TYPES, default=MEMBER_USER)
    date_added = models.DateTimeField(default=timezone.now)

    objects = BaseManager()

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_pendingteammember'
        unique_together = (('team', 'email'),)

    __repr__ = sane_repr('team_id', 'email', 'type')

    @property
    def token(self):
        checksum = md5()
        for x in (str(self.team_id), self.email, settings.SECRET_KEY):
            checksum.update(x)
        return checksum.hexdigest()

    def send_invite_email(self):
        from sentry.utils.email import MessageBuilder

        context = {
            'email': self.email,
            'team': self.team,
            'url': absolute_uri(reverse('sentry-accept-invite', kwargs={
                'member_id': self.id,
                'token': self.token,
            })),
        }

        msg = MessageBuilder(
            subject='Invite to join team: %s' % (self.team.name,),
            template='sentry/emails/member_invite.txt',
            context=context,
        )

        try:
            msg.send([self.email])
        except Exception, e:
            logger = logging.getLogger('sentry.mail.errors')
            logger.exception(e)
