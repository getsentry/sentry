from __future__ import absolute_import, print_function

import six

from bitfield import BitField
from datetime import timedelta
from django.db import models
from django.utils import timezone
from uuid import uuid4

from sentry.db.models import ArrayField, Model, FlexibleForeignKey

DEFAULT_EXPIRATION = timedelta(minutes=10)


def default_expiration():
    return timezone.now() + DEFAULT_EXPIRATION


def generate_code():
    return uuid4().hex


class ApiGrant(Model):
    """
    A grant represents a token with a short lifetime that can
    be swapped for an access token, as described in :rfc:`4.1.2`
    of the OAuth 2 spec.
    """

    __core__ = False

    user = FlexibleForeignKey("sentry.User")
    application = FlexibleForeignKey("sentry.ApiApplication")
    code = models.CharField(max_length=64, db_index=True, default=generate_code)
    expires_at = models.DateTimeField(db_index=True, default=default_expiration)
    redirect_uri = models.CharField(max_length=255)
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

    class Meta:
        app_label = "sentry"
        db_table = "sentry_apigrant"

    def get_scopes(self):
        if self.scope_list:
            return self.scope_list
        return [k for k, v in six.iteritems(self.scopes) if v]

    def has_scope(self, scope):
        return scope in self.get_scopes()

    def is_expired(self):
        return timezone.now() >= self.expires_at

    def redirect_uri_allowed(self, uri):
        return uri == self.redirect_uri
