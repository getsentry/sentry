from __future__ import absolute_import

import six

from collections import Iterable
from sentry.coreapi import APIError

from sentry.constants import SentryAppStatus
from sentry.mediators import Mediator, Param
from sentry.mediators.param import if_param
from sentry.models.sentryapp import VALID_EVENT_PERMISSIONS


class Updater(Mediator):
    sentry_app = Param('sentry.models.SentryApp')
    name = Param(six.string_types, required=False)
    scopes = Param(Iterable, required=False)
    events = Param(Iterable, required=False)
    webhook_url = Param(six.string_types, required=False)
    redirect_url = Param(six.string_types, required=False)
    is_alertable = Param(bool, required=False)
    overview = Param(six.string_types, required=False)

    def call(self):
        self._update_name()
        self._update_scopes()
        self._update_events()
        self._update_webhook_url()
        self._update_redirect_url()
        self._update_is_alertable()
        self._update_overview()
        self.sentry_app.save()
        return self.sentry_app

    @if_param('name')
    def _update_name(self):
        self.sentry_app.name = self.name

    @if_param('scopes')
    def _update_scopes(self):
        if self.sentry_app.status == SentryAppStatus.PUBLISHED:
            raise APIError('Cannot update scopes on published App.')
        self.sentry_app.scope_list = self.scopes

    @if_param('events')
    def _update_events(self):
        for event in self.events:
            needed_scope = VALID_EVENT_PERMISSIONS[event]
            if needed_scope not in self.sentry_app.scope_list:
                raise APIError(
                    u'{} webhooks require the {} permission.'.format(event, needed_scope),
                )

        from sentry.mediators.service_hooks.creator import expand_events
        self.sentry_app.events = expand_events(self.events)

    @if_param('webhook_url')
    def _update_webhook_url(self):
        self.sentry_app.webhook_url = self.webhook_url

    @if_param('redirect_url')
    def _update_redirect_url(self):
        self.sentry_app.redirect_url = self.redirect_url

    @if_param('is_alertable')
    def _update_is_alertable(self):
        self.sentry_app.is_alertable = self.is_alertable

    @if_param('overview')
    def _update_overview(self):
        self.sentry_app.overview = self.overview
