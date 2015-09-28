from __future__ import absolute_import

from django.db import models
from django.utils import timezone
from hashlib import md5

from sentry.db.models import FlexibleForeignKey, Model, sane_repr
from sentry.utils.cache import memoize


class EventUser(Model):
    __core__ = False

    project = FlexibleForeignKey('sentry.Project')
    hash = models.CharField(max_length=32)
    ident = models.CharField(max_length=64, null=True)
    email = models.EmailField(null=True)
    username = models.CharField(max_length=64, null=True)
    ip_address = models.GenericIPAddressField(null=True)
    date_added = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_eventuser'
        unique_together = (('project', 'ident'), ('project', 'hash'))
        index_together = (
            ('project', 'email'),
            ('project', 'username'),
            ('project', 'ip_address'),
        )

    __repr__ = sane_repr('project_id', 'ident', 'email', 'username', 'ip_address')

    def save(self, *args, **kwargs):
        assert self.ident or self.username or self.email or self.ip_address, \
            'No identifying value found for user'
        if not self.hash:
            self.hash = self.get_hash()
        super(EventUser, self).save(*args, **kwargs)

    def get_hash(self):
        value = self.ident or self.username or self.email or self.ip_address
        return md5(value).hexdigest()

    @memoize
    def tag_value(self):
        """
        Return the identifier used with tags to link this user.
        """
        assert self.ident or self.username or self.email or self.ip_address, \
            'No identifying value found for user'

        if self.ident:
            return 'id:{}'.format(self.ident)
        if self.email:
            return 'email:{}'.format(self.email)
        if self.username:
            return 'username:{}'.format(self.username)
        if self.ip_address:
            return 'ip:{}'.format(self.ip_address)

    def get_label(self):
        return self.email or self.username or self.ident or self.ip_address
