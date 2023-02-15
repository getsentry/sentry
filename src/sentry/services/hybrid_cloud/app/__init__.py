from __future__ import annotations

import abc
import datetime
import hmac
import inspect
from dataclasses import dataclass, field
from hashlib import sha256
from typing import Any, Dict, List, Optional, TypedDict

from sentry.constants import SentryAppInstallationStatus
from sentry.db.models.fields.jsonfield import JSONField
from sentry.models.project import Project
from sentry.services.hybrid_cloud import InterfaceWithLifecycle, silo_mode_delegation, stubbed
from sentry.services.hybrid_cloud.filter_query import FilterQueryInterface
from sentry.silo import SiloMode
from sentry.utils import json


class SentryAppInstallationFilterArgs(TypedDict, total=False):
    id: int
    organization_id: int
    uuid: str
    date_deleted: Optional[datetime.datetime]
    status: int  # SentryAppInstallationStatus
    app_is_alertable: bool


@dataclass
class RpcSentryAppInstallation:
    id: int = -1
    organization_id: int = -1
    status: int = SentryAppInstallationStatus.PENDING
    uuid: str = ""
    sentry_app: RpcSentryApp = field(default_factory=lambda: RpcSentryApp())


ApiSentryAppInstallation = RpcSentryAppInstallation

    # Overallow arguments, e.g. from full model initialization
    @classmethod
    def from_dict(cls, **kwargs) -> ApiSentryAppInstallation:  # type: ignore
        return cls(**{k: v for k, v in kwargs.items() if k in inspect.signature(cls).parameters})

    def prepare_ui_component(
        self,
        component: Optional[ApiSentryAppComponent],
        project: Project = None,
        values: Optional[Dict[str, Any]] = None,
    ) -> Optional[ApiSentryAppComponent]:
        from sentry.coreapi import APIError
        from sentry.mediators import sentry_app_components

        if component is None:
            return None
        if values is None:
            values = {}
        try:
            sentry_app_components.Preparer.run(
                component=component,
                install=self,
                sentry_app=self.sentry_app,
                project=project,
                values=values,
            )
            return component
        except APIError:
            # TODO(nisanthan): For now, skip showing the UI Component if the API requests fail
            return None


@dataclass
class RpcApiApplication:
    id: int = -1
    client_id: str = ""
    client_secret: str = ""


ApiApiApplication = RpcApiApplication


@dataclass
class RpcSentryApp:
    id: int = -1
    scope_list: List[str] = field(default_factory=list)
    application: RpcApiApplication = field(default_factory=RpcApiApplication)
    proxy_user_id: int | None = None  # can be null on deletion.
    owner_id: int = -1  # relation to an organization
    name: str = ""
    slug: str = ""
    uuid: str = ""
    status: str = ""
    events: List[str] = field(default_factory=list)
    is_alertable: bool = False
    components: List[RpcSentryAppComponent] = field(default_factory=list)
    webhook_url: str = ""
    is_internal: bool = True
    is_unpublished: bool = True

    def get_component(self, type: str) -> Optional[RpcSentryAppComponent]:
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


ApiSentryApp = RpcSentryApp


@dataclass
class RpcSentryAppComponent:
    uuid: str = ""
    type: str = ""
    schema: JSONField = None

    # Overallow arguments, e.g. from full model initialization
    @classmethod
    def from_dict(cls, **kwargs) -> ApiSentryAppComponent:  # type: ignore
        o = cls(**{k: v for k, v in kwargs.items() if k in inspect.signature(cls).parameters})
        if isinstance(o.schema, str):
            o.schema = json.loads(o.schema)
        return o


ApiSentryAppComponent = RpcSentryAppComponent


class AppService(
    FilterQueryInterface[SentryAppInstallationFilterArgs, RpcSentryAppInstallation, None],
    InterfaceWithLifecycle,
):
    @abc.abstractmethod
    def find_installation_by_proxy_user(
        self, *, proxy_user_id: int, organization_id: int
    ) -> RpcSentryAppInstallation | None:
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
        sentry_app_id: Optional[int] = None,
    ) -> List[RpcSentryAppInstallation]:
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
