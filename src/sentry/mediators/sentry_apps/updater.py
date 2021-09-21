from collections.abc import Iterable

from django.db.models import Q
from django.utils import timezone

from sentry import analytics
from sentry.constants import SentryAppStatus
from sentry.coreapi import APIError
from sentry.mediators import Mediator, Param, service_hooks
from sentry.mediators.param import if_param
from sentry.models import ApiToken, SentryAppComponent, SentryAppInstallation, ServiceHook
from sentry.models.sentryapp import REQUIRED_EVENT_PERMISSIONS


class Updater(Mediator):
    sentry_app = Param("sentry.models.SentryApp")
    name = Param((str,), required=False)
    status = Param((str,), required=False)
    scopes = Param(Iterable, required=False)
    events = Param(Iterable, required=False)
    webhook_url = Param((str,), required=False)
    redirect_url = Param((str,), required=False)
    is_alertable = Param(bool, required=False)
    verify_install = Param(bool, required=False)
    schema = Param(dict, required=False)
    overview = Param((str,), required=False)
    allowed_origins = Param(Iterable, required=False)
    user = Param("sentry.models.User")

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
        self._update_allowed_origins()
        self._update_schema()
        self._update_service_hooks()
        self.sentry_app.save()
        return self.sentry_app

    @if_param("name")
    def _update_name(self):
        self.sentry_app.name = self.name

    @if_param("author")
    def _update_author(self):
        self.sentry_app.author = self.author

    @if_param("status")
    def _update_status(self):
        if self.user.is_superuser:
            if self.status == SentryAppStatus.PUBLISHED_STR:
                self.sentry_app.status = SentryAppStatus.PUBLISHED
                self.sentry_app.date_published = timezone.now()
            if self.status == SentryAppStatus.UNPUBLISHED_STR:
                self.sentry_app.status = SentryAppStatus.UNPUBLISHED
        if self.status == SentryAppStatus.PUBLISH_REQUEST_INPROGRESS_STR:
            self.sentry_app.status = SentryAppStatus.PUBLISH_REQUEST_INPROGRESS

    @if_param("scopes")
    def _update_scopes(self):
        if (
            self.sentry_app.status == SentryAppStatus.PUBLISHED
            and self.sentry_app.scope_list != self.scopes
        ):
            raise APIError("Cannot update permissions on a published integration.")
        self.sentry_app.scope_list = self.scopes
        # update the scopes of active tokens tokens
        ApiToken.objects.filter(
            Q(expires_at__isnull=True) | Q(expires_at__gt=timezone.now()),
            application=self.sentry_app.application,
        ).update(scope_list=list(self.scopes))

    @if_param("events")
    def _update_events(self):
        for event in self.events:
            needed_scope = REQUIRED_EVENT_PERMISSIONS[event]
            if needed_scope not in self.sentry_app.scope_list:
                raise APIError(f"{event} webhooks require the {needed_scope} permission.")

        from sentry.mediators.service_hooks.creator import expand_events

        self.sentry_app.events = expand_events(self.events)

    def _update_service_hooks(self):
        hooks = ServiceHook.objects.filter(application=self.sentry_app.application)
        # sentry_app.webhook_url will be updated at this point
        webhook_url = self.sentry_app.webhook_url
        for hook in hooks:
            # update the url and events
            if webhook_url:
                service_hooks.Updater.run(
                    service_hook=hook, events=self.sentry_app.events, url=webhook_url
                )
            # if no url, then the service hook is no longer active in which case we need to delete it
            else:
                service_hooks.Destroyer.run(service_hook=hook)
        # if we don't have hooks but we have a webhook url now, need to create it for an internal integration
        if webhook_url and self.sentry_app.is_internal and not hooks:
            installation = SentryAppInstallation.objects.get(sentry_app_id=self.sentry_app.id)
            service_hooks.Creator.run(
                application=self.sentry_app.application,
                actor=installation,
                projects=[],
                organization=self.sentry_app.owner,
                events=self.sentry_app.events,
                url=webhook_url,
            )

    @if_param("webhook_url")
    def _update_webhook_url(self):
        self.sentry_app.webhook_url = self.webhook_url

    @if_param("redirect_url")
    def _update_redirect_url(self):
        self.sentry_app.redirect_url = self.redirect_url

    @if_param("is_alertable")
    def _update_is_alertable(self):
        self.sentry_app.is_alertable = self.is_alertable

    @if_param("verify_install")
    def _update_verify_install(self):
        if self.sentry_app.is_internal and self.verify_install:
            raise APIError("Internal integrations cannot have verify_install=True.")
        self.sentry_app.verify_install = self.verify_install

    @if_param("overview")
    def _update_overview(self):
        self.sentry_app.overview = self.overview

    @if_param("allowed_origins")
    def _update_allowed_origins(self):
        self.sentry_app.application.allowed_origins = "\n".join(self.allowed_origins)
        self.sentry_app.application.save()

    @if_param("schema")
    def _update_schema(self):
        self.sentry_app.schema = self.schema
        self._delete_old_ui_components()
        self._create_ui_components()

    def _delete_old_ui_components(self):
        SentryAppComponent.objects.filter(sentry_app_id=self.sentry_app.id).delete()

    def _create_ui_components(self):
        for element in self.schema.get("elements", []):
            SentryAppComponent.objects.create(
                type=element["type"], sentry_app_id=self.sentry_app.id, schema=element
            )

    def record_analytics(self):
        analytics.record(
            "sentry_app.updated", user_id=self.user.id, sentry_app=self.sentry_app.slug
        )
