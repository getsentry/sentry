# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

import abc
from collections.abc import Mapping
from typing import Any

from sentry.auth.services.auth import AuthenticationContext
from sentry.features.rollout import in_random_rollout
from sentry.hybridcloud.rpc.caching.service import back_with_silo_cache, back_with_silo_cache_list
from sentry.hybridcloud.rpc.filter_query import OpaqueSerializedResponse
from sentry.hybridcloud.rpc.service import RpcService, rpc_method
from sentry.sentry_apps.services.app import (
    RpcAlertRuleActionResult,
    RpcSentryApp,
    RpcSentryAppComponent,
    RpcSentryAppEventData,
    RpcSentryAppInstallation,
    RpcSentryAppService,
    SentryAppInstallationFilterArgs,
)
from sentry.sentry_apps.services.app.model import RpcSentryAppComponentContext
from sentry.silo.base import SiloMode
from sentry.users.services.user import RpcUser


class AppService(RpcService):
    key = "app"
    local_mode = SiloMode.CONTROL

    @classmethod
    def get_local_implementation(cls) -> RpcService:
        from sentry.sentry_apps.services.app.impl import DatabaseBackedAppService

        return DatabaseBackedAppService()

    @rpc_method
    @abc.abstractmethod
    def serialize_many(
        self,
        *,
        filter: SentryAppInstallationFilterArgs,
        as_user: RpcUser | None = None,
        auth_context: AuthenticationContext | None = None,
    ) -> list[OpaqueSerializedResponse]:
        pass

    @rpc_method
    @abc.abstractmethod
    def get_many(
        self, *, filter: SentryAppInstallationFilterArgs
    ) -> list[RpcSentryAppInstallation]:
        pass

    @rpc_method
    @abc.abstractmethod
    def find_installation_by_proxy_user(
        self, *, proxy_user_id: int, organization_id: int
    ) -> RpcSentryAppInstallation | None:
        pass

    @rpc_method
    @abc.abstractmethod
    def get_installed_for_organization(
        self,
        *,
        organization_id: int,
    ) -> list[RpcSentryAppInstallation]:
        # Deprecated use installations_for_organization instead.
        pass

    def installations_for_organization(
        self, *, organization_id: int
    ) -> list[RpcSentryAppInstallation]:
        """
        Get a list of installations for an organization_id

        This is a cached wrapper around get_installations_for_organization
        """
        if in_random_rollout("app_service.installations_for_org.cached"):
            return get_installations_for_organization(organization_id)
        else:
            return self.get_installed_for_organization(organization_id=organization_id)

    @rpc_method
    @abc.abstractmethod
    def get_installations_for_organization(
        self, *, organization_id: int
    ) -> list[RpcSentryAppInstallation]:
        pass

    @rpc_method
    @abc.abstractmethod
    def get_sentry_app_by_id(self, *, id: int) -> RpcSentryApp | None:
        pass

    @rpc_method
    @abc.abstractmethod
    def get_sentry_app_by_slug(self, *, slug: str) -> RpcSentryApp | None:
        pass

    @rpc_method
    @abc.abstractmethod
    def get_installation_by_id(self, *, id: int) -> RpcSentryAppInstallation | None:
        pass

    def installation_by_id(self, *, id: int) -> RpcSentryAppInstallation | None:
        """
        Get a sentryapp install by id

        This method is a cached wrapper around get_installation_by_id()
        """
        return get_installation(id)

    @rpc_method
    @abc.abstractmethod
    def get_installation_org_id_by_token_id(self, token_id: int) -> int | None:
        """
        Get the organization id for an installation by installation token_id

        This is a specialized RPC call used by ratelimit middleware
        """
        pass

    @rpc_method
    @abc.abstractmethod
    def get_installation_token(self, *, organization_id: int, provider: str) -> str | None:
        pass

    @rpc_method
    @abc.abstractmethod
    def find_alertable_services(self, *, organization_id: int) -> list[RpcSentryAppService]:
        pass

    @rpc_method
    @abc.abstractmethod
    def find_service_hook_sentry_app(self, *, api_application_id: int) -> RpcSentryApp | None:
        pass

    def get_by_application_id(self, *, application_id: int) -> RpcSentryApp | None:
        """
        Get a SentryApp by application_id with caching

        Wraps find_service_hook_sentry_app with caching.
        """
        return get_by_application_id(application_id)

    @rpc_method
    @abc.abstractmethod
    def get_custom_alert_rule_actions(
        self,
        *,
        event_data: RpcSentryAppEventData,
        organization_id: int,
        project_slug: str | None,
    ) -> list[Mapping[str, Any]]:
        pass

    @rpc_method
    @abc.abstractmethod
    def find_app_components(self, *, app_id: int) -> list[RpcSentryAppComponent]:
        pass

    @rpc_method
    @abc.abstractmethod
    def get_component_contexts(
        self, *, filter: SentryAppInstallationFilterArgs, component_type: str
    ) -> list[RpcSentryAppComponentContext]:
        """
        Get a context object for sentryapp components of a certain type.
        Used for building sentryapp actions for alerts.

        :param filter: The filtering conditions, same conditions as get_many()
        :param component_type: The sentry-app component to get
        """

    @rpc_method
    @abc.abstractmethod
    def trigger_sentry_app_action_creators(
        self, *, fields: list[Mapping[str, Any]], install_uuid: str | None
    ) -> RpcAlertRuleActionResult:
        pass

    @rpc_method
    @abc.abstractmethod
    def get_published_sentry_apps_for_organization(
        self, *, organization_id: int
    ) -> list[RpcSentryApp]:
        pass

    @rpc_method
    @abc.abstractmethod
    def create_internal_integration_for_channel_request(
        self,
        *,
        organization_id: int,
        integration_name: str,
        integration_scopes: list[str],
        integration_creator_id: int,
        metadata: dict[str, Any] | None = None,
    ) -> RpcSentryAppInstallation:
        pass

    @rpc_method
    @abc.abstractmethod
    def prepare_sentry_app_components(
        self, *, installation_id: int, component_type: str, project_slug: str | None = None
    ) -> RpcSentryAppComponent | None:
        pass

    @rpc_method
    @abc.abstractmethod
    def disable_sentryapp(self, *, id: int) -> None:
        pass


@back_with_silo_cache("app_service.get_installation", SiloMode.REGION, RpcSentryAppInstallation)
def get_installation(id: int) -> RpcSentryAppInstallation | None:
    return app_service.get_installation_by_id(id=id)


@back_with_silo_cache_list(
    "app_service.get_installed_for_organization", SiloMode.REGION, RpcSentryAppInstallation
)
def get_installations_for_organization(organization_id: int) -> list[RpcSentryAppInstallation]:
    return app_service.get_installations_for_organization(organization_id=organization_id)


@back_with_silo_cache("app_service.get_by_application_id", SiloMode.REGION, RpcSentryApp)
def get_by_application_id(application_id: int) -> RpcSentryApp | None:
    return app_service.find_service_hook_sentry_app(api_application_id=application_id)


app_service = AppService.create_delegation()
