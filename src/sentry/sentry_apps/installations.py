from __future__ import annotations

import dataclasses
import datetime
from functools import cached_property

from django.db import router, transaction
from django.http.request import HttpRequest

from sentry import analytics, audit_log
from sentry.constants import INTERNAL_INTEGRATION_TOKEN_COUNT_MAX, SentryAppInstallationStatus
from sentry.exceptions import ApiTokenLimitError
from sentry.models.apiapplication import ApiApplication
from sentry.models.apigrant import ApiGrant
from sentry.models.apitoken import ApiToken
from sentry.models.integrations.sentry_app import SentryApp
from sentry.models.integrations.sentry_app_installation import SentryAppInstallation
from sentry.models.integrations.sentry_app_installation_token import SentryAppInstallationToken
from sentry.models.user import User
from sentry.services.hybrid_cloud.hook import hook_service
from sentry.tasks.sentry_apps import installation_webhook


@dataclasses.dataclass
class SentryAppInstallationTokenCreator:
    sentry_app_installation: SentryAppInstallation
    expires_at: datetime.date | None = None
    generate_audit: bool = False

    def run(self, user: User, request: HttpRequest | None = None) -> ApiToken:
        with transaction.atomic(router.db_for_write(ApiToken)):
            self._check_token_limit()
            api_token = self._create_api_token()
            self._create_sentry_app_installation_token(api_token=api_token)
            self.audit(request, api_token)
        self.record_analytics(user)
        return api_token

    def _check_token_limit(self) -> None:
        curr_count = SentryAppInstallationToken.objects.filter(
            sentry_app_installation=self.sentry_app_installation
        ).count()
        if curr_count >= INTERNAL_INTEGRATION_TOKEN_COUNT_MAX:
            raise ApiTokenLimitError(
                "Cannot generate more than %d tokens for a single integration"
                % INTERNAL_INTEGRATION_TOKEN_COUNT_MAX
            )

    def _create_api_token(self) -> ApiToken:
        return ApiToken.objects.create(
            user=self.sentry_app.proxy_user,
            application_id=self.sentry_app.application.id,
            scope_list=self.sentry_app.scope_list,
            expires_at=self.expires_at,
        )

    def _create_sentry_app_installation_token(
        self, api_token: ApiToken
    ) -> SentryAppInstallationToken:
        return SentryAppInstallationToken.objects.create(
            api_token=api_token, sentry_app_installation=self.sentry_app_installation
        )

    def audit(self, request: HttpRequest | None, api_token: ApiToken) -> None:
        from sentry.utils.audit import create_audit_entry

        if request and self.generate_audit:
            create_audit_entry(
                request=request,
                organization=self.organization_id,
                target_object=api_token.id,
                event=audit_log.get_event_id("INTERNAL_INTEGRATION_ADD_TOKEN"),
                data={"sentry_app": self.sentry_app.name},
            )

    def record_analytics(self, user: User) -> None:
        from sentry import analytics

        analytics.record(
            "sentry_app_installation_token.created",
            user_id=user.id,
            organization_id=self.organization_id,
            sentry_app_installation_id=self.sentry_app_installation.id,
            sentry_app=self.sentry_app.slug,
        )

    @cached_property
    def sentry_app(self) -> SentryApp:
        return self.sentry_app_installation.sentry_app

    @cached_property
    def organization_id(self) -> int:
        return self.sentry_app_installation.organization_id


@dataclasses.dataclass
class SentryAppInstallationCreator:
    organization_id: int
    slug: str
    notify: bool = True

    def run(self, *, user: User, request: HttpRequest | None) -> SentryAppInstallation:
        with transaction.atomic(router.db_for_write(ApiGrant)):
            api_grant = self._create_api_grant()
            install = self._create_install(api_grant=api_grant)
            self.audit(request=request)

        self._create_service_hooks(install=install)
        install.is_new = True

        if self.notify:
            installation_webhook.delay(install.id, user.id)

        self.record_analytics(user=user)
        return install

    def _create_install(self, api_grant: ApiGrant) -> SentryAppInstallation:
        status = SentryAppInstallationStatus.PENDING
        if not self.sentry_app.verify_install:
            status = SentryAppInstallationStatus.INSTALLED

        return SentryAppInstallation.objects.create(
            organization_id=self.organization_id,
            sentry_app_id=self.sentry_app.id,
            api_grant_id=api_grant.id,
            status=status,
        )

    def _create_api_grant(self) -> ApiGrant:
        return ApiGrant.objects.create(
            user_id=self.sentry_app.proxy_user.id, application_id=self.api_application.id
        )

    def _create_service_hooks(self, install: SentryAppInstallation) -> None:
        # only make the service hook if there is a webhook url
        if self.sentry_app.webhook_url:
            hook_service.create_service_hook(
                application_id=self.api_application.id,
                actor_id=install.id,
                installation_id=install.id,
                organization_id=self.organization_id,
                events=self.sentry_app.events,
                url=self.sentry_app.webhook_url,
            )

    def audit(self, request: HttpRequest | None) -> None:
        from sentry.utils.audit import create_audit_entry

        if request:
            create_audit_entry(
                request=request,
                organization_id=self.organization_id,
                target_object=self.organization_id,
                event=audit_log.get_event_id("SENTRY_APP_INSTALL"),
                data={"sentry_app": self.sentry_app.name},
            )

    def record_analytics(self, user: User) -> None:
        analytics.record(
            "sentry_app.installed",
            user_id=user.id,
            organization_id=self.organization_id,
            sentry_app=self.slug,
        )

    @cached_property
    def api_application(self) -> ApiApplication:
        return self.sentry_app.application

    @cached_property
    def sentry_app(self) -> SentryApp:
        return SentryApp.objects.get(slug=self.slug)
