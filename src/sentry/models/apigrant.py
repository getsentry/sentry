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
            (u"project:read", u"project:read"),
            (u"project:write", u"project:write"),
            (u"project:admin", u"project:admin"),
            (u"project:releases", u"project:releases"),
            (u"team:read", u"team:read"),
            (u"team:write", u"team:write"),
            (u"team:admin", u"team:admin"),
            (u"event:read", u"event:read"),
            (u"event:write", u"event:write"),
            (u"event:admin", u"event:admin"),
            (u"org:read", u"org:read"),
            (u"org:write", u"org:write"),
            (u"org:admin", u"org:admin"),
            (u"member:read", u"member:read"),
            (u"member:write", u"member:write"),
            (u"member:admin", u"member:admin"),
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
