from __future__ import absolute_import

import six

from collections import Iterable

from sentry import analytics
from sentry.coreapi import APIError
from sentry.constants import SentryAppStatus
from sentry.mediators import Mediator, Param
from sentry.mediators import service_hooks
from sentry.mediators.param import if_param
from sentry.models import SentryAppComponent, ServiceHook
from sentry.models.sentryapp import REQUIRED_EVENT_PERMISSIONS


class Updater(Mediator):
    sentry_app = Param('sentry.models.SentryApp')
    name = Param(six.string_types, required=False)
    status = Param(six.string_types, required=False)
    scopes = Param(Iterable, required=False)
    events = Param(Iterable, required=False)
    webhook_url = Param(six.string_types, required=False)
    redirect_url = Param(six.string_types, required=False)
    is_alertable = Param(bool, required=False)
    verify_install = Param(bool, required=False)
    schema = Param(dict, required=False)
    overview = Param(six.string_types, required=False)
    user = Param('sentry.models.User')

    def call(self):
        self._update_name()
        self._update_author()
        self._update_status()
        self._update_scopes()
        self._update_events()
        self._update_webhook_url()
        self._update_redirect_url()
        self._update_is_alertable()
        self._update_verify_install()
        self._update_overview()
        self._update_schema()
        self.sentry_app.save()
        return self.sentry_app

    @if_param('name')
    def _update_name(self):
        self.sentry_app.name = self.name

    @if_param('author')
    def _update_author(self):
        self.sentry_app.author = self.author

    @if_param('status')
    def _update_status(self):
        if self.user.is_superuser:
            if self.status == 'published':
                self.sentry_app.status = SentryAppStatus.PUBLISHED
            if self.status == 'unpublished':
                self.sentry_app.status = SentryAppStatus.UNPUBLISHED

    @if_param('scopes')
    def _update_scopes(self):
        if self.sentry_app.status == SentryAppStatus.PUBLISHED:
            raise APIError('Cannot update scopes on published App.')
        self.sentry_app.scope_list = self.scopes

    @if_param('events')
    def _update_events(self):
        for event in self.events:
            needed_scope = REQUIRED_EVENT_PERMISSIONS[event]
            if needed_scope not in self.sentry_app.scope_list:
                raise APIError(
                    u'{} webhooks require the {} permission.'.format(event, needed_scope),
                )

        from sentry.mediators.service_hooks.creator import expand_events
        self.sentry_app.events = expand_events(self.events)
        self._update_service_hook_events()

    def _update_service_hook_events(self):
        hooks = ServiceHook.objects.filter(application=self.sentry_app.application)
        for hook in hooks:
            service_hooks.Updater.run(service_hook=hook, events=self.events)

    @if_param('webhook_url')
    def _update_webhook_url(self):
        self.sentry_app.webhook_url = self.webhook_url

    @if_param('redirect_url')
    def _update_redirect_url(self):
        self.sentry_app.redirect_url = self.redirect_url

    @if_param('is_alertable')
    def _update_is_alertable(self):
        self.sentry_app.is_alertable = self.is_alertable

    @if_param('verify_install')
    def _update_verify_install(self):
        if self.sentry_app.is_internal:
            raise APIError(
                u'Cannot update this option for internal integrations.',
            )
        self.sentry_app.verify_install = self.verify_install

    @if_param('overview')
    def _update_overview(self):
        self.sentry_app.overview = self.overview

    @if_param('schema')
    def _update_schema(self):
        self.sentry_app.schema = self.schema
        self._delete_old_ui_components()
        self._create_ui_components()

    def _delete_old_ui_components(self):
        SentryAppComponent.objects.filter(
            sentry_app_id=self.sentry_app.id,
        ).delete()

    def _create_ui_components(self):
        for element in self.schema.get('elements', []):
            SentryAppComponent.objects.create(
                type=element['type'],
                sentry_app_id=self.sentry_app.id,
                schema=element,
            )

    def record_analytics(self):
        analytics.record(
            'sentry_app.updated',
            user_id=self.user.id,
            sentry_app=self.sentry_app.slug,
        )
