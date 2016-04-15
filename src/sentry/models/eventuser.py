from __future__ import absolute_import

from django.db import models
from django.utils import timezone

from sentry.db.models import FlexibleForeignKey, Model, sane_repr
from sentry.utils.hashlib import md5

KEYWORD_MAP = {
    'id': 'ident',
    'email': 'email',
    'username': 'username',
    'ip': 'ip_address',
}


class EventUser(Model):
    __core__ = False

    project = FlexibleForeignKey('sentry.Project')
    hash = models.CharField(max_length=32)
    ident = models.CharField(max_length=128, null=True)
    email = models.EmailField(null=True)
    username = models.CharField(max_length=128, null=True)
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

    @classmethod
    def attr_from_keyword(cls, keyword):
        return KEYWORD_MAP[keyword]

    def save(self, *args, **kwargs):
        assert self.ident or self.username or self.email or self.ip_address, \
            'No identifying value found for user'
        if not self.hash:
            self.hash = self.get_hash()
        super(EventUser, self).save(*args, **kwargs)

    def get_hash(self):
        value = self.ident or self.username or self.email or self.ip_address
        return md5(value).hexdigest()

    @property
    def tag_value(self):
        """
        Return the identifier used with tags to link this user.
        """
        if self.ident:
            return u'id:{}'.format(self.ident)
        if self.email:
            return u'email:{}'.format(self.email)
        if self.username:
            return u'username:{}'.format(self.username)
        if self.ip_address:
            return u'ip:{}'.format(self.ip_address)

    def get_label(self):
        return self.email or self.username or self.ident or self.ip_address

    def get_display_name(self):
        return self.email or self.username
