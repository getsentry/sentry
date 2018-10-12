from __future__ import absolute_import

import six

from collections import Iterable
from rest_framework.serializers import ValidationError

from sentry.mediators import Mediator, Param
from sentry.mediators.param import if_param


class Updater(Mediator):
    sentry_app = Param('sentry.models.SentryApp')
    name = Param(six.string_types, required=False)
    scopes = Param(Iterable, required=False)
    webhook_url = Param(six.string_types, required=False)

    def call(self):
        self._update_name()
        self._update_scopes()
        self._update_webhook_url()
        self.sentry_app.save()
        return self.sentry_app

    @if_param('name')
    def _update_name(self):
        self.sentry_app.name = self.name

    @if_param('scopes')
    def _update_scopes(self):
        self._validate_only_added_scopes()
        self.sentry_app.scope_list = self.scopes

    @if_param('webhook_url')
    def _update_webhook_url(self):
        self.sentry_app.webhook_url = self.webhook_url

    def _validate_only_added_scopes(self):
        if any(self._scopes_removed):
            raise ValidationError('Cannot remove `scopes` already in use.')

    @property
    def _scopes_removed(self):
        return [s for s in self.sentry_app.scope_list if s not in self.scopes]
