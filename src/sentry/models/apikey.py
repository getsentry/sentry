from __future__ import absolute_import, print_function

import six

from bitfield import BitField
from django.db import models
from django.utils import timezone
from django.utils.translation import ugettext_lazy as _
from uuid import uuid4

from sentry.db.models import (
    ArrayField,
    Model,
    BaseManager,
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    sane_repr,
)
from sentry.utils.compat import filter


# TODO(dcramer): pull in enum library
class ApiKeyStatus(object):
    ACTIVE = 0
    INACTIVE = 1


class ApiKey(Model):
    __core__ = True

    organization = FlexibleForeignKey("sentry.Organization", related_name="key_set")
    label = models.CharField(max_length=64, blank=True, default="Default")
    key = models.CharField(max_length=32, unique=True)
    scopes = BitField(
        flags=(
            ("project:read", "project:read"),
            ("project:write", "project:write"),
            ("project:admin", "project:admin"),
            ("project:releases", "project:releases"),
            ("team:read", "team:read"),
            ("team:write", "team:write"),
            ("team:admin", "team:admin"),
            ("event:read", "event:read"),
            ("event:write", "event:write"),
            ("event:admin", "event:admin"),
            ("org:read", "org:read"),
            ("org:write", "org:write"),
            ("org:admin", "org:admin"),
            ("member:read", "member:read"),
            ("member:write", "member:write"),
            ("member:admin", "member:admin"),
        )
    )
    scope_list = ArrayField(of=models.TextField)
    status = BoundedPositiveIntegerField(
        default=0,
        choices=((ApiKeyStatus.ACTIVE, _("Active")), (ApiKeyStatus.INACTIVE, _("Inactive"))),
        db_index=True,
    )
    date_added = models.DateTimeField(default=timezone.now)
    allowed_origins = models.TextField(blank=True, null=True)

    objects = BaseManager(cache_fields=("key",))

    class Meta:
        app_label = "sentry"
        db_table = "sentry_apikey"

    __repr__ = sane_repr("organization_id", "key")

    def __unicode__(self):
        return six.text_type(self.key)

    @classmethod
    def generate_api_key(cls):
        return uuid4().hex

    @property
    def is_active(self):
        return self.status == ApiKeyStatus.ACTIVE

    def save(self, *args, **kwargs):
        if not self.key:
            self.key = ApiKey.generate_api_key()
        super(ApiKey, self).save(*args, **kwargs)

    def get_allowed_origins(self):
        if not self.allowed_origins:
            return []
        return filter(bool, self.allowed_origins.split("\n"))

    def get_audit_log_data(self):
        return {
            "label": self.label,
            "key": self.key,
            "scopes": self.get_scopes(),
            "status": self.status,
        }

    def get_scopes(self):
        if self.scope_list:
            return self.scope_list
        return [k for k, v in six.iteritems(self.scopes) if v]

    def has_scope(self, scope):
        return scope in self.get_scopes()
