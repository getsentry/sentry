from __future__ import absolute_import, print_function

import six

from bitfield import BitField
from django.db import models
from django.utils import timezone
from uuid import uuid4

from sentry.db.models import (
    Model, BaseManager, FlexibleForeignKey, sane_repr
)


class ApiToken(Model):
    __core__ = True

    # users can generate tokens without being key-bound
    key = FlexibleForeignKey('sentry.ApiKey', null=True)
    user = FlexibleForeignKey('sentry.User')
    token = models.CharField(max_length=64, unique=True)
    scopes = BitField(flags=(
        ('project:read', 'project:read'),
        ('project:write', 'project:write'),
        ('project:delete', 'project:delete'),
        ('project:releases', 'project:releases'),
        ('team:read', 'team:read'),
        ('team:write', 'team:write'),
        ('team:delete', 'team:delete'),
        ('event:read', 'event:read'),
        ('event:write', 'event:write'),
        ('event:delete', 'event:delete'),
        ('org:read', 'org:read'),
        ('org:write', 'org:write'),
        ('org:delete', 'org:delete'),
        ('member:read', 'member:read'),
        ('member:write', 'member:write'),
        ('member:delete', 'member:delete'),
    ))
    date_added = models.DateTimeField(default=timezone.now)

    objects = BaseManager(cache_fields=(
        'token',
    ))

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_apitoken'

    __repr__ = sane_repr('key_id', 'user_id', 'token')

    def __unicode__(self):
        return six.text_type(self.token)

    @classmethod
    def generate_token(cls):
        return uuid4().hex + uuid4().hex

    def save(self, *args, **kwargs):
        if not self.token:
            self.token = type(self).generate_token()
        super(ApiToken, self).save(*args, **kwargs)

    def get_audit_log_data(self):
        return {
            'scopes': int(self.scopes),
        }

    def get_scopes(self):
        return [k for k, v in six.iteritems(self.scopes) if v]

    def has_scope(self, scope):
        return scope in self.scopes

    def get_allowed_origins(self):
        if self.key:
            return self.key.get_allowed_origins()
        return ()
