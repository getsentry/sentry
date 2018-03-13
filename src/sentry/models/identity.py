from __future__ import absolute_import

from django.conf import settings
from django.db import models
from django.utils import timezone

from sentry.db.models import (
    ArrayField, BoundedPositiveIntegerField, EncryptedJsonField,
    FlexibleForeignKey, Model
)


# TODO(dcramer): pull in enum library
class IdentityStatus(object):
    UNKNOWN = 0
    VALID = 1
    INVALID = 2


class IdentityProvider(Model):
    """
    An IdentityProvider is an instance of a provider.

    The IdentityProvider is unique on the type of provider (eg gtihub, slack,
    google, etc) and the organization which has configured that provider for
    it's users.

    A SAML identity provide might look like this, type: onelogin, instance:
    acme-org.onelogin.com.
    """
    __core__ = False

    type = models.CharField(max_length=64)
    organization = FlexibleForeignKey('sentry.Organization')
    config = EncryptedJsonField()

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_identityprovider'
        unique_together = (('type', 'organization'),)

    @classmethod
    def get(cls, type, instance):
        # TODO(dcramer): add caching
        return cls.objects.get_or_create(
            type=type,
            instance=instance,
        )[0]


class Identity(Model):
    """
    A verified link between a user and a third party identity.
    """
    __core__ = False

    idp = FlexibleForeignKey('sentry.IdentityProvider')
    user = FlexibleForeignKey(settings.AUTH_USER_MODEL)
    external_id = models.CharField(max_length=64)
    data = EncryptedJsonField()
    status = BoundedPositiveIntegerField(default=IdentityStatus.UNKNOWN)
    scopes = ArrayField()
    date_verified = models.DateTimeField(default=timezone.now)
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_identity'
        unique_together = (('idp', 'external_id'),)
