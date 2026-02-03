from __future__ import annotations

import dataclasses
import datetime
from functools import cached_property
from typing import TypedDict

from django.db import router, transaction
from django.http.request import HttpRequest

from sentry import analytics, audit_log
from sentry.analytics.events.sentry_app_installation_token_created import (
    SentryAppInstallationTokenCreated,
)
from sentry.analytics.events.sentry_app_installation_updated import (
    SentryAppInstallationUpdatedEvent,
)
from sentry.analytics.events.sentry_app_installed import SentryAppInstalledEvent
from sentry.api.serializers import serialize
from sentry.constants import INTERNAL_INTEGRATION_TOKEN_COUNT_MAX, SentryAppInstallationStatus
from sentry.exceptions import ApiTokenLimitError
from sentry.models.apigrant import ApiGrant
from sentry.models.apitoken import ApiToken
from sentry.sentry_apps.api.serializers.app_platform_event import AppPlatformEvent
from sentry.sentry_apps.api.serializers.sentry_app_installation import (
    SentryAppInstallationResult,
    SentryAppInstallationSerializer,
)
from sentry.sentry_apps.metrics import (
    SentryAppEventType,
    SentryAppInteractionEvent,
    SentryAppInteractionType,
)
from sentry.sentry_apps.models.sentry_app import SentryApp
from sentry.sentry_apps.models.sentry_app_installation import SentryAppInstallation
from sentry.sentry_apps.models.sentry_app_installation_token import SentryAppInstallationToken
from sentry.sentry_apps.services.hook import hook_service
from sentry.sentry_apps.tasks.sentry_apps import installation_webhook
from sentry.sentry_apps.utils.errors import SentryAppSentryError
from sentry.sentry_apps.utils.webhooks import InstallationActionType, SentryAppResourceType
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser
from sentry.utils import metrics
from sentry.utils.sentry_apps import send_and_save_webhook_request

VALID_ACTIONS = ["created", "deleted"]


@dataclasses.dataclass
class SentryAppInstallationTokenCreator:
    sentry_app_installation: SentryAppInstallation
    expires_at: datetime.date | None = None

    def run(self, user: User | RpcUser, request: HttpRequest | None = None) -> ApiToken:
        with transaction.atomic(router.db_for_write(ApiToken)):
            self._check_token_limit()
            api_token = self._create_api_token()
            self._create_sentry_app_installation_token(api_token=api_token)
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
            application_id=self.sentry_app.application_id,
            scope_list=self.sentry_app.scope_list,
            expires_at=self.expires_at,
        )

    def _create_sentry_app_installation_token(
        self, api_token: ApiToken
    ) -> SentryAppInstallationToken:
        return SentryAppInstallationToken.objects.create(
            api_token=api_token, sentry_app_installation=self.sentry_app_installation
        )

    def record_analytics(self, user: User | RpcUser) -> None:
        from sentry import analytics

        analytics.record(
            SentryAppInstallationTokenCreated(
                user_id=user.id,
                organization_id=self.organization_id,
                sentry_app_installation_id=self.sentry_app_installation.id,
                sentry_app=self.sentry_app.slug,
            )
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

    def run(self, *, user: User | RpcUser, request: HttpRequest | None) -> SentryAppInstallation:
        with SentryAppInteractionEvent(
            operation_type=SentryAppInteractionType.MANAGEMENT,
            event_type=SentryAppEventType.INSTALLATION_CREATE,
        ).capture() as lifecycle:
            with transaction.atomic(router.db_for_write(ApiGrant)):
                api_grant = self._create_api_grant()
                install = self._create_install(api_grant=api_grant)
                lifecycle.add_extra("installation_id", install.id)

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
            user_id=self.sentry_app.proxy_user_id, application_id=self.sentry_app.application_id
        )

    def _create_service_hooks(self, install: SentryAppInstallation) -> None:
        # only make the service hook if there is a webhook url
        if self.sentry_app.webhook_url:
            hook_service.create_service_hook(
                application_id=self.sentry_app.application_id,
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

    def record_analytics(self, user: User | RpcUser) -> None:
        analytics.record(
            SentryAppInstalledEvent(
                user_id=user.id,
                organization_id=self.organization_id,
                sentry_app=self.slug,
            )
        )
        metrics.incr("sentry_apps.installation.success")

    @cached_property
    def sentry_app(self) -> SentryApp:
        return SentryApp.objects.get(slug=self.slug)


class SentryAppInstallationWebhookData(TypedDict):
    installation: SentryAppInstallationResult


@dataclasses.dataclass
class SentryAppInstallationNotifier:
    sentry_app_installation: SentryAppInstallation
    user: User | RpcUser
    action: str

    def run(self) -> None:
        if self.action not in VALID_ACTIONS:
            raise SentryAppSentryError(
                f"Invalid action '{self.action} for installation notifier for {self.sentry_app}"
            )

        send_and_save_webhook_request(self.sentry_app, self.request)

    @property
    def request(self) -> AppPlatformEvent[SentryAppInstallationWebhookData]:
        data = serialize(
            self.sentry_app_installation,
            user=self.user,
            serializer=SentryAppInstallationSerializer(),
            is_webhook=True,
        )

        return AppPlatformEvent[SentryAppInstallationWebhookData](
            resource=SentryAppResourceType.INSTALLATION,
            action=InstallationActionType(self.action),
            install=self.sentry_app_installation,
            data=SentryAppInstallationWebhookData(installation=data),
            actor=self.user,
        )

    @cached_property
    def sentry_app(self) -> SentryApp:
        return self.sentry_app_installation.sentry_app

    @cached_property
    def api_grant(self) -> ApiGrant | None:
        return self.sentry_app_installation.api_grant_id and self.sentry_app_installation.api_grant


@dataclasses.dataclass
class SentryAppInstallationUpdater:
    sentry_app_installation: SentryAppInstallation
    status: str | None = None

    def run(self) -> SentryAppInstallation:
        with transaction.atomic(router.db_for_write(SentryAppInstallation)):
            self._update_status()
            self.record_analytics()
            return self.sentry_app_installation

    def _update_status(self) -> None:
        # convert from string to integer
        if self.status == SentryAppInstallationStatus.INSTALLED_STR:
            for install in SentryAppInstallation.objects.filter(id=self.sentry_app_installation.id):
                install.update(status=SentryAppInstallationStatus.INSTALLED)

    def record_analytics(self) -> None:
        analytics.record(
            SentryAppInstallationUpdatedEvent(
                sentry_app_installation_id=self.sentry_app_installation.id,
                sentry_app_id=self.sentry_app_installation.sentry_app.id,
                organization_id=self.sentry_app_installation.organization_id,
            )
        )
