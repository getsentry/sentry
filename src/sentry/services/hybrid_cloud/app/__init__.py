# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud service classes and data models are
# defined, because we want to reflect on type annotations and avoid forward references.

import abc
import datetime
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any, List, Mapping, Optional, Protocol, TypedDict

from sentry.constants import SentryAppInstallationStatus
from sentry.models import SentryApp, SentryAppInstallation
from sentry.services.hybrid_cloud import InterfaceWithLifecycle, silo_mode_delegation, stubbed
from sentry.services.hybrid_cloud.auth import AuthenticationContext
from sentry.services.hybrid_cloud.filter_query import OpaqueSerializedResponse
from sentry.services.hybrid_cloud.user import RpcUser
from sentry.silo import SiloMode

if TYPE_CHECKING:
    from sentry.mediators.external_requests.alert_rule_action_requester import AlertRuleActionResult


@dataclass
class RpcSentryAppService:
    """
    A `SentryAppService` (a notification service) wrapped up and serializable via the
    rpc interface.
    """

    title: str = ""
    slug: str = ""
    service_type: str = "sentry_app"


@dataclass
class RpcSentryApp:
    id: int = -1
    scope_list: List[str] = field(default_factory=list)
    application_id: int = -1
    proxy_user_id: Optional[int] = None  # can be null on deletion.
    owner_id: int = -1  # relation to an organization
    name: str = ""
    slug: str = ""
    uuid: str = ""
    events: List[str] = field(default_factory=list)
    webhook_url: str = ""


@dataclass
class RpcSentryAppInstallation:
    id: int = -1
    organization_id: int = -1
    status: int = SentryAppInstallationStatus.PENDING
    sentry_app: RpcSentryApp = field(default_factory=lambda: RpcSentryApp())
    date_deleted: Optional[datetime.datetime] = None
    uuid: str = ""


@dataclass
class RpcSentryAppComponent:
    uuid: str = ""
    sentry_app_id: int = -1
    type: str = ""
    schema: Mapping[str, Any] = field(default_factory=dict)


class SentryAppEventDataInterface(Protocol):
    """
    Protocol making RpcSentryAppEvents capable of consuming from various sources, keeping only
    the minimum required properties.
    """

    id: str
    label: str

    @property
    def actionType(self) -> str:
        pass

    def is_enabled(self) -> bool:
        pass


@dataclass
class RpcSentryAppEventData(SentryAppEventDataInterface):
    id: str = ""
    label: str = ""
    action_type: str = ""
    enabled: bool = True

    @property
    def actionType(self) -> str:
        return self.action_type

    def is_enabled(self) -> bool:
        return self.enabled

    @classmethod
    def from_event(cls, data_interface: SentryAppEventDataInterface) -> "RpcSentryAppEventData":
        return RpcSentryAppEventData(
            id=data_interface.id,
            label=data_interface.label,
            action_type=data_interface.actionType,
            enabled=data_interface.is_enabled(),
        )


class SentryAppInstallationFilterArgs(TypedDict, total=False):
    installation_ids: List[int]
    app_ids: List[int]
    organization_id: int
    uuids: List[str]


class AppService(InterfaceWithLifecycle):
    @abc.abstractmethod
    def serialize_many(
        self,
        *,
        filter: SentryAppInstallationFilterArgs,
        as_user: Optional[RpcUser] = None,
        auth_context: Optional[AuthenticationContext] = None,
    ) -> List[OpaqueSerializedResponse]:
        pass

    @abc.abstractmethod
    def get_many(
        self, *, filter: SentryAppInstallationFilterArgs
    ) -> List[RpcSentryAppInstallation]:
        pass

    @abc.abstractmethod
    def find_installation_by_proxy_user(
        self, *, proxy_user_id: int, organization_id: int
    ) -> Optional[RpcSentryAppInstallation]:
        pass

    @abc.abstractmethod
    def get_installed_for_organization(
        self,
        *,
        organization_id: int,
    ) -> List[RpcSentryAppInstallation]:
        pass

    @abc.abstractmethod
    def find_alertable_services(self, *, organization_id: int) -> List[RpcSentryAppService]:
        pass

    @classmethod
    def serialize_sentry_app(cls, app: SentryApp) -> RpcSentryApp:
        return RpcSentryApp(
            id=app.id,
            scope_list=app.scope_list,
            application_id=app.application_id,
            proxy_user_id=app.proxy_user_id,
            owner_id=app.owner_id,
            name=app.name,
            slug=app.slug,
            uuid=app.uuid,
            events=app.events,
            webhook_url=app.webhook_url,
        )

    @abc.abstractmethod
    def find_service_hook_sentry_app(self, *, api_application_id: int) -> Optional[RpcSentryApp]:
        pass

    @abc.abstractmethod
    def get_custom_alert_rule_actions(
        self,
        *,
        event_data: RpcSentryAppEventData,
        organization_id: int,
        project_slug: Optional[str],
    ) -> List[Mapping[str, Any]]:
        pass

    @abc.abstractmethod
    def find_app_components(self, *, app_id: int) -> List[RpcSentryAppComponent]:
        pass

    @abc.abstractmethod
    def get_related_sentry_app_components(
        self,
        *,
        organization_ids: List[int],
        sentry_app_ids: List[int],
        type: str,
        group_by: str = "sentry_app_id",
    ) -> Mapping[str, Any]:
        pass

    @classmethod
    def serialize_sentry_app_installation(
        cls, installation: SentryAppInstallation, app: Optional[SentryApp] = None
    ) -> RpcSentryAppInstallation:
        if app is None:
            app = installation.sentry_app

        return RpcSentryAppInstallation(
            id=installation.id,
            organization_id=installation.organization_id,
            status=installation.status,
            sentry_app=cls.serialize_sentry_app(app),
            date_deleted=installation.date_deleted,
            uuid=app.uuid,
        )

    @abc.abstractmethod
    def trigger_sentry_app_action_creators(
        self, *, fields: List[Mapping[str, Any]], install_uuid: Optional[str]
    ) -> "AlertRuleActionResult":
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
