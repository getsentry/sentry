from __future__ import annotations

import abc
from dataclasses import dataclass, field
from typing import List

from sentry.constants import SentryAppInstallationStatus
from sentry.models import SentryApp, SentryAppInstallation
from sentry.services.hybrid_cloud import (
    CreateStubFromBase,
    InterfaceWithLifecycle,
    silo_mode_delegation,
)
from sentry.silo import SiloMode


@dataclass
class ApiSentryApp:
    id: int = -1
    scope_list: List[str] = field(default_factory=list)
    application_id: int = -1
    proxy_user_id: int | None = None  # can be null on deletion.
    owner_id: int = -1  # relation to an organization
    name: str = ""
    slug: str = ""
    uuid: str = ""
    events: List[str] = field(default_factory=list)


@dataclass
class ApiSentryAppInstallation:
    id: int = -1
    organization_id: int = -1
    status: int = SentryAppInstallationStatus.PENDING
    sentry_app: ApiSentryApp = field(default_factory=lambda: ApiSentryApp())


class AppService(InterfaceWithLifecycle):
    @abc.abstractmethod
    def find_installation_by_proxy_user(
        self, *, proxy_user_id: int, organization_id: int
    ) -> ApiSentryAppInstallation | None:
        pass

    @abc.abstractmethod
    def get_installed_for_organization(
        self,
        *,
        organization_id: int,
    ) -> List[ApiSentryAppInstallation]:
        pass

    def serialize_sentry_app(self, app: SentryApp) -> ApiSentryApp:
        return ApiSentryApp(
            id=app.id,
            scope_list=app.scope_list,
            application_id=app.application_id,
            proxy_user_id=app.proxy_user_id,
            owner_id=app.owner_id,
            name=app.name,
            slug=app.slug,
            uuid=app.uuid,
            events=app.events,
        )

    def serialize_sentry_app_installation(
        self, installation: SentryAppInstallation, app: SentryApp | None = None
    ) -> ApiSentryAppInstallation:
        if app is None:
            app = installation.sentry_app

        return ApiSentryAppInstallation(
            id=installation.id,
            organization_id=installation.organization_id,
            status=installation.status,
            sentry_app=self.serialize_sentry_app(app),
        )


class DatabaseBackedAppService(AppService):
    def get_installed_for_organization(
        self, *, organization_id: int
    ) -> List[ApiSentryAppInstallation]:
        installations = SentryAppInstallation.objects.get_installed_for_organization(
            organization_id
        ).select_related("sentry_app")
        return [self.serialize_sentry_app_installation(i, i.sentry_app) for i in installations]

    def find_installation_by_proxy_user(
        self, *, proxy_user_id: int, organization_id: int
    ) -> ApiSentryAppInstallation | None:
        try:
            sentry_app = SentryApp.objects.get(proxy_user_id=proxy_user_id)
        except SentryApp.DoesNotExist:
            return None

        try:
            installation = SentryAppInstallation.objects.get(
                sentry_app_id=sentry_app.id, organization_id=organization_id
            )
        except SentryAppInstallation.DoesNotExist:
            return None

        return self.serialize_sentry_app_installation(installation, sentry_app)

    def close(self) -> None:
        pass


StubAppService = CreateStubFromBase(DatabaseBackedAppService)

app_service: AppService = silo_mode_delegation(
    {
        SiloMode.MONOLITH: lambda: DatabaseBackedAppService(),
        SiloMode.CONTROL: lambda: DatabaseBackedAppService(),
        SiloMode.REGION: lambda: StubAppService(),
    }
)
