# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

import datetime
import hmac
from collections.abc import MutableMapping
from hashlib import sha256
from typing import Any, Protocol, TypedDict

from pydantic.fields import Field

from sentry.constants import SentryAppInstallationStatus
from sentry.hybridcloud.rpc import RpcModel, RpcModelProtocolMeta


class RpcApiApplication(RpcModel):
    id: int = -1
    client_id: str = Field(repr=False, default="")
    client_secret: str = Field(repr=False, default="")


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
    scope_list: list[str] = Field(default_factory=list)
    application_id: int = -1
    application: RpcApiApplication | None = None
    proxy_user_id: int | None = None  # can be null on deletion.
    owner_id: int = -1  # relation to an organization
    name: str = ""
    slug: str = ""
    uuid: str = ""
    events: list[str] = Field(default_factory=list)
    webhook_url: str | None = None
    is_alertable: bool = False
    is_published: bool = False
    is_unpublished: bool = False
    is_internal: bool = True
    is_publish_request_inprogress: bool = False
    status: str = ""
    metadata: dict[str, Any] = Field(default_factory=dict)

    def show_auth_info(self, access: Any) -> bool:
        encoded_scopes = set({"%s" % scope for scope in list(access.scopes)})
        return set(self.scope_list).issubset(encoded_scopes)

    def build_signature(self, body: str) -> str:
        assert self.application, "Cannot build_signature without an application"

        secret = self.application.client_secret
        return hmac.new(
            key=secret.encode("utf-8"), msg=body.encode("utf-8"), digestmod=sha256
        ).hexdigest()

    # Properties are copied from the sentry app ORM model.
    @property
    def slug_for_metrics(self) -> str:
        if self.is_internal:
            return "internal"
        if self.is_unpublished:
            return "unpublished"
        return self.slug


class RpcSentryAppInstallation(RpcModel):
    id: int = -1
    organization_id: int = -1
    status: int = SentryAppInstallationStatus.PENDING
    sentry_app: RpcSentryApp = Field(default_factory=lambda: RpcSentryApp())
    date_deleted: datetime.datetime | None = None
    uuid: str = ""
    api_token: str | None = None


class RpcSentryAppComponent(RpcModel):
    uuid: str = ""
    sentry_app_id: int = -1
    type: str = ""
    app_schema: MutableMapping[str, Any] = Field(default_factory=dict)


class RpcSentryAppComponentContext(RpcModel):
    installation: RpcSentryAppInstallation
    component: RpcSentryAppComponent


class RpcAlertRuleActionResult(RpcModel):
    success: bool
    message: str


class SentryAppEventDataInterface(Protocol):
    """
    Protocol making RpcSentryAppEvents capable of consuming from various sources, keeping only
    the minimum required properties.
    """

    @property
    def id(self) -> str: ...

    @property
    def label(self) -> str: ...

    @property
    def actionType(self) -> str: ...

    def is_enabled(self) -> bool: ...


class RpcSentryAppEventData(RpcModel, metaclass=RpcModelProtocolMeta):
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
    installation_ids: list[int]
    app_ids: list[int]
    organization_id: int
    uuids: list[str]
    status: int
    api_token_id: int
    api_installation_token_id: str
