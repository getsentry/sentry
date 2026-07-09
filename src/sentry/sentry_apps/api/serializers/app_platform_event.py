from collections.abc import Mapping
from enum import StrEnum
from functools import cached_property
from time import time
from typing import Any, TypedDict
from uuid import uuid4

from sentry.sentry_apps.models.sentry_app_installation import SentryAppInstallation
from sentry.sentry_apps.services.app.model import RpcSentryAppInstallation
from sentry.sentry_apps.utils.headers import mask_header_values, parse_custom_headers
from sentry.sentry_apps.utils.webhooks import SentryAppActionType, SentryAppResourceType
from sentry.users.models.user import User
from sentry.users.services.user import RpcUser
from sentry.utils import json


class AppPlatformEventActorType(StrEnum):
    USER = "user"
    APPLICATION = "application"


class AppPlatformEventActor(TypedDict):
    type: AppPlatformEventActorType
    id: str | int
    name: str


class AppPlatformEventInstallation(TypedDict):
    uuid: str


class AppPlatformEventBody[T: Mapping[str, Any]](TypedDict):
    action: SentryAppActionType
    installation: AppPlatformEventInstallation
    data: T
    actor: AppPlatformEventActor


class AppPlatformEvent[T: Mapping[str, Any]]:
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
                type=AppPlatformEventActorType.APPLICATION,
                id="sentry",
                name="Sentry",
            )

        if self.actor.is_sentry_app:
            return AppPlatformEventActor(
                type=AppPlatformEventActorType.APPLICATION,
                id=self.install.sentry_app.uuid,
                name=self.install.sentry_app.name,
            )

        return AppPlatformEventActor(
            type=AppPlatformEventActorType.USER,
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

    @cached_property
    def sentry_headers(self) -> dict[str, str]:
        """Headers Sentry sets on every webhook request.

        Cached so the Request-ID, timestamp, and signature are computed once and
        stay consistent between the sent request and the logged buffer entry.
        """
        request_uuid = uuid4().hex

        return {
            "Content-Type": "application/json",
            "Request-ID": request_uuid,
            "Sentry-Hook-Resource": self.resource,
            "Sentry-Hook-Timestamp": str(int(time())),
            "Sentry-Hook-Signature": self.install.sentry_app.build_signature(self.body),
        }

    @property
    def custom_headers(self) -> dict[str, str]:
        """User-configured headers parsed from the SentryApp's webhook_headers."""
        return parse_custom_headers(self.install.sentry_app.webhook_headers)

    @property
    def headers(self) -> dict[str, str]:
        # Sentry's headers are merged last so they always win: a custom header
        # can never override the signature and spoof payload integrity.
        return {**self.custom_headers, **self.sentry_headers}

    @property
    def masked_custom_headers(self) -> dict[str, str]:
        """Custom header names with their values replaced by MASKED_VALUE.

        Custom header values may carry secrets (e.g. bearer tokens), so they are
        never persisted to the request buffer. The names are kept so the debug UI
        can show which custom headers were sent without leaking the values.
        """
        return mask_header_values(self.custom_headers)

    @property
    def loggable_headers(self) -> dict[str, str]:
        """Headers safe to record in the request buffer / debug UI.

        Sentry's own headers in the clear, plus custom headers with masked values.
        Sentry's headers are merged last so the buffer mirrors the precedence of
        what was actually sent (see ``headers``).
        """
        return {**self.masked_custom_headers, **self.sentry_headers}
