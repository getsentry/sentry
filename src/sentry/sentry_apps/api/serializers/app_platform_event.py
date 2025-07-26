from collections.abc import Mapping
from time import time
from typing import Any, Generic, TypedDict, TypeVar
from uuid import uuid4

from sentry.sentry_apps.models.sentry_app import SentryAppActionType, SentryAppResourceType
from sentry.sentry_apps.models.sentry_app_installation import SentryAppInstallation
from sentry.sentry_apps.services.app.model import RpcSentryAppInstallation
from sentry.users.models.user import User
from sentry.users.services.user import RpcUser
from sentry.utils import json


class AppPlatformEventActor(TypedDict):
    type: str
    id: str | int
    name: str


class AppPlatformEventInstallation(TypedDict):
    uuid: str


T = TypeVar("T", bound=Mapping[str, Any])


class AppPlatformEventBody(TypedDict, Generic[T]):
    action: SentryAppActionType
    installation: AppPlatformEventInstallation
    data: T
    actor: AppPlatformEventActor


class AppPlatformEvent(Generic[T]):
    """
    This data structure encapsulates the payload sent to a SentryApp's webhook.

    The data field is generic and should be typed with a TypedDict specified by the user.
    """

    def __init__(
        self,
        resource: SentryAppResourceType,
        action: SentryAppActionType,
        install: RpcSentryAppInstallation | SentryAppInstallation,
        data: T,
        actor: RpcUser | User | None = None,
    ):
        self.resource = resource
        self.action = action
        self.install = install
        self.data = data
        self.actor = actor

    def get_actor(self) -> AppPlatformEventActor:
        # when sentry auto assigns, auto resolves, etc.
        # or when an alert rule is triggered
        if not self.actor:
            return AppPlatformEventActor(
                type="application",
                id="sentry",
                name="Sentry",
            )

        if self.actor.is_sentry_app:
            return AppPlatformEventActor(
                type="application",
                id=self.install.sentry_app.uuid,
                name=self.install.sentry_app.name,
            )

        return AppPlatformEventActor(
            type="user",
            id=self.actor.id,
            name=self.actor.name,
        )

    @property
    def body(self) -> str:
        return json.dumps(
            AppPlatformEventBody(
                action=self.action,
                installation=AppPlatformEventInstallation(uuid=self.install.uuid),
                data=self.data,
                actor=self.get_actor(),
            )
        )

    @property
    def headers(self) -> dict[str, str]:
        request_uuid = uuid4().hex

        return {
            "Content-Type": "application/json",
            "Request-ID": request_uuid,
            "Sentry-Hook-Resource": self.resource,
            "Sentry-Hook-Timestamp": str(int(time())),
            "Sentry-Hook-Signature": self.install.sentry_app.build_signature(self.body),
        }
