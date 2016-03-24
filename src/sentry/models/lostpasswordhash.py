"""
sentry.models.useroption
~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from datetime import timedelta
from django.conf import settings
from django.core.urlresolvers import reverse
from django.db import models
from django.utils import timezone

from sentry.db.models import FlexibleForeignKey, Model, sane_repr
from sentry.utils.http import absolute_uri


class LostPasswordHash(Model):
    __core__ = False

    user = FlexibleForeignKey(settings.AUTH_USER_MODEL, unique=True)
    hash = models.CharField(max_length=32)
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_lostpasswordhash'

    __repr__ = sane_repr('user_id', 'hash')

    def save(self, *args, **kwargs):
        if not self.hash:
            self.set_hash()
        super(LostPasswordHash, self).save(*args, **kwargs)

    def set_hash(self):
        import hashlib
        import random

        self.hash = hashlib.md5(str(random.randint(1, 10000000))).hexdigest()

    def is_valid(self):
        return self.date_added > timezone.now() - timedelta(hours=48)

    def send_recover_mail(self):
        from sentry import options
        from sentry.http import get_server_hostname
        from sentry.utils.email import MessageBuilder

        context = {
            'user': self.user,
            'domain': get_server_hostname(),
            'url': absolute_uri(reverse(
                'sentry-account-recover-confirm',
                args=[self.user.id, self.hash]
            )),
        }
        msg = MessageBuilder(
            subject='%sPassword Recovery' % (options.get('mail.subject-prefix'),),
            template='sentry/emails/recover_account.txt',
            context=context,
        )
        msg.send_async([self.user.email])
