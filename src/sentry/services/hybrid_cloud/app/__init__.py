from __future__ import annotations

import abc
import datetime
import hmac
from dataclasses import dataclass, field
from hashlib import sha256
from typing import Any, Dict, List, Optional, TypedDict

from sentry.constants import SentryAppInstallationStatus
from sentry.db.models.fields.jsonfield import JSONField
from sentry.services.hybrid_cloud import InterfaceWithLifecycle, silo_mode_delegation, stubbed
from sentry.services.hybrid_cloud.filter_query import FilterQueryInterface
from sentry.silo import SiloMode


class SentryAppInstallationFilterArgs(TypedDict, total=False):
    id: int
    organization_id: int
    uuid: str
    date_deleted: Optional[datetime.datetime]
    status: int  # SentryAppInstallationStatus


@dataclass
class ApiSentryAppInstallation:
    id: int = -1
    organization_id: int = -1
    status: int = SentryAppInstallationStatus.PENDING
    uuid: str = ""
    sentry_app: ApiSentryApp = field(default_factory=lambda: ApiSentryApp())


@dataclass
class ApiApiApplication:
    id: int = -1
    client_id: str = ""
    client_secret: str = ""


@dataclass
class ApiSentryApp:
    id: int = -1
    scope_list: List[str] = field(default_factory=list)
    application: ApiApiApplication = field(default_factory=ApiApiApplication)
    proxy_user_id: int | None = None  # can be null on deletion.
    owner_id: int = -1  # relation to an organization
    name: str = ""
    slug: str = ""
    uuid: str = ""
    status: str = ""
    events: List[str] = field(default_factory=list)
    is_alertable: bool = False
    components: List[ApiSentryAppComponent] = field(default_factory=list)
    webhook_url: str = ""
    is_internal: bool = True
    is_unpublished: bool = True

    def get_component(self, type: str) -> Optional[ApiSentryAppComponent]:
        for c in self.components:
            if c.type == type:
                return c
        return None

    def build_signature(self, body: str) -> str:
        secret = self.application.client_secret
        return hmac.new(
            key=secret.encode("utf-8"), msg=body.encode("utf-8"), digestmod=sha256
        ).hexdigest()

    @property
    def slug_for_metrics(self) -> str:
        if self.is_internal:
            return "internal"
        if self.is_unpublished:
            return "unpublished"
        return self.slug


@dataclass
class ApiSentryAppComponent:
    uuid: str = ""
    type: str = ""
    schema: JSONField = None


class AppService(
    FilterQueryInterface[SentryAppInstallationFilterArgs, ApiSentryAppInstallation, None],
    InterfaceWithLifecycle,
):
    @abc.abstractmethod
    def find_installation_by_proxy_user(
        self, *, proxy_user_id: int, organization_id: int
    ) -> ApiSentryAppInstallation | None:
        pass

    @abc.abstractmethod
    def get_related_sentry_app_components(
        self,
        *,
        organization_ids: List[int],
        type: str,
        sentry_app_ids: Optional[List[int]] = None,
        sentry_app_uuids: Optional[List[str]] = None,
        group_by: str = "sentry_app_id",
    ) -> Dict[str | int, Dict[str, Dict[str, Any]]]:
        pass

    @abc.abstractmethod
    def get_installed_for_organization(
        self,
        *,
        organization_id: int,
    ) -> List[ApiSentryAppInstallation]:
        pass


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
