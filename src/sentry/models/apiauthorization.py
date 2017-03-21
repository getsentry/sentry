from __future__ import absolute_import, print_function

from bitfield import BitField
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
    scopes = BitField(flags=(
        ('project:read', 'project:read'),
        ('project:write', 'project:write'),
        ('project:admin', 'project:admin'),
        ('project:releases', 'project:releases'),
        ('team:read', 'team:read'),
        ('team:write', 'team:write'),
        ('team:admin', 'team:admin'),
        ('event:read', 'event:read'),
        ('event:write', 'event:write'),
        ('event:admin', 'event:admin'),
        ('org:read', 'org:read'),
        ('org:write', 'org:write'),
        ('org:admin', 'org:admin'),
        ('member:read', 'member:read'),
        ('member:write', 'member:write'),
        ('member:admin', 'member:admin'),
    ))
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_apiauthorization'
        unique_together = (('user', 'application'),)

    __repr__ = sane_repr('user_id', 'application_id')
