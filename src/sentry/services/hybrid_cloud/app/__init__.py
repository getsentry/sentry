# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud service classes and data models are
# defined, because we want to reflect on type annotations and avoid forward references.

import abc
import datetime
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, List, Mapping, Optional, Protocol, TypedDict, cast

from pydantic.fields import Field

from sentry.constants import SentryAppInstallationStatus
from sentry.models import SentryApp, SentryAppInstallation
from sentry.services.hybrid_cloud import RpcModel
from sentry.services.hybrid_cloud.filter_query import FilterQueryInterface
from sentry.services.hybrid_cloud.rpc import RpcService, rpc_method
from sentry.silo import SiloMode

if TYPE_CHECKING:
    from sentry.mediators.external_requests.alert_rule_action_requester import AlertRuleActionResult


class RpcSentryAppService(RpcModel):
    """
    A `SentryAppService` (a notification service) wrapped up and serializable via the
    rpc interface.
    """

    title: str = ""
    slug: str = ""
    service_type: str = "sentry_app"


class RpcSentryApp(RpcModel):
    id: int = -1
    scope_list: List[str] = Field(default_factory=list)
    application_id: int = -1
    proxy_user_id: Optional[int] = None  # can be null on deletion.
    owner_id: int = -1  # relation to an organization
    name: str = ""
    slug: str = ""
    uuid: str = ""
    events: List[str] = Field(default_factory=list)
    webhook_url: str = ""


class RpcSentryAppInstallation(RpcModel):
    id: int = -1
    organization_id: int = -1
    status: int = SentryAppInstallationStatus.PENDING
    sentry_app: RpcSentryApp = Field(default_factory=lambda: RpcSentryApp())
    date_deleted: Optional[datetime.datetime] = None
    uuid: str = ""


class RpcSentryAppComponent(RpcModel):
    uuid: str = ""
    sentry_app_id: int = -1
    type: str = ""
    app_schema: Mapping[str, Any] = Field(default_factory=dict)


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


@dataclass  # TODO: Make compatible with RpcModel
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


class AppService(
    FilterQueryInterface[SentryAppInstallationFilterArgs, "RpcSentryAppInstallation", None],
    RpcService,
):
    name = "app"
    local_mode = SiloMode.REGION

    @classmethod
    def get_local_implementation(cls) -> RpcService:
        from sentry.services.hybrid_cloud.app.impl import DatabaseBackedAppService

        return DatabaseBackedAppService()

    @rpc_method
    @abc.abstractmethod
    def find_installation_by_proxy_user(
        self, *, proxy_user_id: int, organization_id: int
    ) -> Optional[RpcSentryAppInstallation]:
        pass

    @rpc_method
    @abc.abstractmethod
    def get_installed_for_organization(
        self,
        *,
        organization_id: int,
    ) -> List[RpcSentryAppInstallation]:
        pass

    @rpc_method
    @abc.abstractmethod
    def find_alertable_services(self, *, organization_id: int) -> List[RpcSentryAppService]:
        pass

    def serialize_sentry_app(self, app: SentryApp) -> RpcSentryApp:
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
            webhook_url=app.webhook_url or "",
        )

    @rpc_method
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

    @rpc_method
    @abc.abstractmethod
    def find_app_components(self, *, app_id: int) -> List[RpcSentryAppComponent]:
        pass

    @rpc_method
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

    def serialize_sentry_app_installation(
        self, installation: SentryAppInstallation, app: Optional[SentryApp] = None
    ) -> RpcSentryAppInstallation:
        if app is None:
            app = installation.sentry_app

        return RpcSentryAppInstallation(
            id=installation.id,
            organization_id=installation.organization_id,
            status=installation.status,
            sentry_app=self.serialize_sentry_app(app),
            date_deleted=installation.date_deleted,
            uuid=app.uuid,
        )

    @rpc_method
    @abc.abstractmethod
    def trigger_sentry_app_action_creators(
        self, *, fields: List[Mapping[str, Any]], install_uuid: Optional[str]
    ) -> "AlertRuleActionResult":
        pass


app_service = cast(AppService, AppService.resolve_to_delegation())
