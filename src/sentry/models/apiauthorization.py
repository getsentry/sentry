from __future__ import absolute_import, print_function

import six

from bitfield import BitField
from django.db import models
from django.utils import timezone

from sentry.models.apiscopes import ApiScopes
from sentry.db.models import (ArrayField, Model, FlexibleForeignKey, sane_repr)


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
    scopes = BitField(flags=ApiScopes().to_bitfield())
    scope_list = ArrayField(of=models.TextField)
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_apiauthorization'
        unique_together = (('user', 'application'), )

    __repr__ = sane_repr('user_id', 'application_id')

    def get_scopes(self):
        if self.scope_list:
            return self.scope_list
        return [k for k, v in six.iteritems(self.scopes) if v]

    def has_scope(self, scope):
        return scope in self.get_scopes()
