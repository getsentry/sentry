"""
sentry.models.organizationmember
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

import logging

from django.conf import settings
from django.core.urlresolvers import reverse
from django.db import models
from django.utils import timezone
from django.utils.translation import ugettext_lazy as _
from hashlib import md5

from sentry.db.models import Model, BoundedPositiveIntegerField, sane_repr
from sentry.utils.http import absolute_uri


# TODO(dcramer): pull in enum library
class OrganizationMemberType(object):
    ADMIN = 0
    MEMBER = 50
    BOT = 100


class OrganizationMember(Model):
    """
    Identifies relationships between teams and users.

    Users listed as team members are considered to have access to all projects
    and could be thought of as team owners (though their access level may not)
    be set to ownership.
    """
    organization = models.ForeignKey('sentry.Organization', related_name="member_set")

    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True,
                             related_name="sentry_orgmember_set")
    email = models.EmailField(null=True)

    type = BoundedPositiveIntegerField(choices=(
        (OrganizationMemberType.MEMBER, _('Member')),
        (OrganizationMemberType.ADMIN, _('Admin')),
        (OrganizationMemberType.BOT, _('Bot')),
    ), default=OrganizationMemberType.MEMBER)
    date_added = models.DateTimeField(default=timezone.now)
    has_global_access = models.BooleanField(default=True)
    teams = models.ManyToManyField('sentry.Team')

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_organizationmember'
        unique_together = (('organization', 'user'), ('organization', 'email'))

    __repr__ = sane_repr('organization_id', 'user_id', 'type')

    def save(self, *args, **kwargs):
        assert self.user_id or self.email, \
            'Must set user or email'
        return super(OrganizationMember, self).save(*args, **kwargs)

    @property
    def is_pending(self):
        return self.user_id is None

    @property
    def token(self):
        checksum = md5()
        for x in (str(self.organization_id), self.email, settings.SECRET_KEY):
            checksum.update(x)
        return checksum.hexdigest()

    def send_invite_email(self):
        from sentry.utils.email import MessageBuilder

        context = {
            'email': self.email,
            'organization': self.organization,
            'url': absolute_uri(reverse('sentry-accept-invite', kwargs={
                'member_id': self.id,
                'token': self.token,
            })),
        }

        msg = MessageBuilder(
            subject='Invite to join organization: %s' % (self.organization.name,),
            template='sentry/emails/member_invite.txt',
            context=context,
        )

        try:
            msg.send([self.email])
        except Exception as e:
            logger = logging.getLogger('sentry.mail.errors')
            logger.exception(e)

    def get_display_name(self):
        if self.user_id:
            return self.user.get_display_name()
        return self.email

    def get_email(self):
        if self.user_id:
            return self.user.email
        return self.email
