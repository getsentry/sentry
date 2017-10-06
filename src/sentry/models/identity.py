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

    For example, we may auto generate some, such as github.com, where it's
    ``IdentityProvider(type='github', instance='github.com')``

    When possible the instance should be the domain used.
    """
    __core__ = False

    type = models.CharField(max_length=64)
    instance = models.CharField(max_length=64)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_identityprovider'
        unique_together = (('type', 'instance'),)

    @classmethod
    def get(cls, type, instance):
        # TODO(dcramer): add caching
        return cls.objects.get_or_create(
            type=type,
            instance=instance,
        )[0]


class Identity(Model):
    """
    A unique identity with an external provider (e.g. GitHub).
    """
    __core__ = False

    idp = FlexibleForeignKey('sentry.IdentityProvider')
    external_id = models.CharField(max_length=64)
    data = EncryptedJsonField()
    status = BoundedPositiveIntegerField(
        default=IdentityStatus.UNKNOWN,
    )
    scopes = ArrayField()
    date_verified = models.DateTimeField(default=timezone.now)
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_identity'
        unique_together = (('idp', 'external_id'),)


class UserIdentity(Model):
    """
    A verified link between a user and a third party identity.
    """
    __core__ = False

    user = FlexibleForeignKey(settings.AUTH_USER_MODEL)
    identity = FlexibleForeignKey('sentry.Identity')
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_useridentity'
        unique_together = (('user', 'identity'),)
