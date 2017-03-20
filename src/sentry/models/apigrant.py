from __future__ import absolute_import, print_function

from bitfield import BitField
from datetime import timedelta
from django.conf import settings
from django.db import models
from django.utils import timezone
from uuid import uuid4

from sentry.db.models import Model, FlexibleForeignKey

DEFAULT_EXPIRATION = timedelta(minutes=10)


class ApiGrant(Model):
    """
    A grant represents a token with a short lifetime that can
    be swapped for an access token, as described in :rfc:`4.1.2`
    of the OAuth 2 spec.
    """
    __core__ = False

    user = FlexibleForeignKey('sentry.User')
    application = FlexibleForeignKey('sentry.ApiApplication')
    code = models.CharField(
        max_length=64, db_index=True,
        default=lambda: ApiGrant.generate_code())
    expires_at = models.DateTimeField(
        db_index=True,
        default=lambda: timezone.now() + DEFAULT_EXPIRATION)
    redirect_uri = models.CharField(max_length=255)
    scopes = BitField(flags=tuple((k, k) for k in settings.SENTRY_SCOPES))

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_apigrant'

    @classmethod
    def generate_code(cls):
        return uuid4().hex

    def is_expired(self):
        if not self.expires_at:
            return True

        return timezone.now() >= self.expires_at

    def redirect_uri_allowed(self, uri):
        return uri == self.redirect_uri
