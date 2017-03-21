from __future__ import absolute_import, print_function

from bitfield import BitField
from django.conf import settings
from django.db import models
from django.utils import timezone

from sentry.db.models import (
    Model, FlexibleForeignKey, sane_repr
)


class ApiAuthorization(Model):
    """
    Tracks which scopes a user has authorized for a given application.

    This is used to determine when we need re-prompt a user, as well as track
    overall approved applications (vs individual tokens).
    """
    __core__ = True

    # users can generate tokens without being application-bound
    application = FlexibleForeignKey('sentry.ApiApplication', null=True)
    user = FlexibleForeignKey('sentry.User')
    scopes = BitField(flags=tuple((k, k) for k in settings.SENTRY_SCOPES))
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_apiauthorization'
        unique_together = (('user', 'application'),)

    __repr__ = sane_repr('user_id', 'application_id')
