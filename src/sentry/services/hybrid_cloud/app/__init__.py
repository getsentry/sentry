from __future__ import annotations

import abc
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, List

from sentry.constants import SentryAppInstallationStatus
from sentry.services.hybrid_cloud import InterfaceWithLifecycle, silo_mode_delegation, stubbed
from sentry.silo import SiloMode

if TYPE_CHECKING:
    from sentry.models import SentryApp, SentryAppInstallation


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


def impl_with_db() -> AppService:
    from sentry.services.hybrid_cloud.app.impl import DatabaseBackedAppService

    return DatabaseBackedAppService()


app_service: AppService = silo_mode_delegation(
    {
        SiloMode.MONOLITH: impl_with_db,
        SiloMode.CONTROL: impl_with_db,
        SiloMode.REGION: stubbed(impl_with_db, SiloMode.CONTROL),
    }
)


@dataclass
class ApiSentryAppInstallation:
    id: int = -1
    organization_id: int = -1
    status: int = SentryAppInstallationStatus.PENDING
    sentry_app: ApiSentryApp = field(default_factory=lambda: ApiSentryApp())


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
