# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

import abc
from typing import Any

from sentry.auth.services.auth import AuthenticationContext
from sentry.hybridcloud.rpc.resolvers import ByOrganizationId, ByOrganizationIdAttribute
from sentry.hybridcloud.rpc.service import RpcService, cell_rpc_method
from sentry.sentry_apps.services.app import RpcSentryApp, RpcSentryAppInstallation
from sentry.sentry_apps.services.cell.model import (
    RpcEmptyResult,
    RpcInteractionStatsResult,
    RpcPlatformExternalIssueResult,
    RpcSelectRequesterResult,
    RpcServiceHookProjectsResult,
)
from sentry.silo.base import SiloMode
from sentry.users.services.user import RpcUser


class SentryAppCellService(RpcService):
    """
    Region silo service for Sentry App operations that require access to region-specific data
    (like projects, issues, etc.).

    Enables control silo endpoints to perform operations that access or modify region silo data
    without creating a bunch of services and RPC calls.
    """

    key = "sentry_app_region"
    local_mode = SiloMode.CELL

    @classmethod
    def get_local_implementation(cls) -> RpcService:
        from sentry.sentry_apps.services.cell.impl import DatabaseBackedSentryAppCellService

        return DatabaseBackedSentryAppCellService()

    def get_component_interaction_key(self, sentry_app_slug: str, component_type: str) -> str:
        """Combines SentryApp.slug and SentryAppComponent.type to create a unique key for TSDB metrics."""
        return f"{sentry_app_slug}:{component_type}"

    @cell_rpc_method(ByOrganizationId())
    @abc.abstractmethod
    def get_select_options(
        self,
        *,
        organization_id: int,
        installation: RpcSentryAppInstallation,
        uri: str,
        project_id: int | None = None,
        query: str | None = None,
        dependent_data: str | None = None,
    ) -> RpcSelectRequesterResult:
        """Invokes SelectRequester to get select options."""
        pass

    @cell_rpc_method(ByOrganizationId())
    @abc.abstractmethod
    def create_issue_link(
        self,
        *,
        organization_id: int,
        installation: RpcSentryAppInstallation,
        group_id: int,
        action: str,
        fields: dict[str, Any],
        uri: str,
        user: RpcUser,
    ) -> RpcPlatformExternalIssueResult:
        """Invokes IssueLinkCreator to create an issue link."""
        pass

    @cell_rpc_method(ByOrganizationId())
    @abc.abstractmethod
    def create_external_issue(
        self,
        *,
        organization_id: int,
        installation: RpcSentryAppInstallation,
        group_id: int,
        web_url: str,
        project: str,
        identifier: str,
    ) -> RpcPlatformExternalIssueResult:
        """Invokes ExternalIssueCreator to create an external issue."""
        pass

    @cell_rpc_method(ByOrganizationId())
    @abc.abstractmethod
    def delete_external_issue(
        self,
        *,
        organization_id: int,
        installation: RpcSentryAppInstallation,
        external_issue_id: int,
    ) -> RpcEmptyResult:
        """Deletes a PlatformExternalIssue."""
        pass

    @cell_rpc_method(ByOrganizationId())
    @abc.abstractmethod
    def get_service_hook_projects(
        self,
        *,
        organization_id: int,
        installation: RpcSentryAppInstallation,
        auth_context: AuthenticationContext,
    ) -> RpcServiceHookProjectsResult:
        """
        Returns the service hook projects associated with an installation.
        Validates that the caller has access to all required projects.
        """
        pass

    @cell_rpc_method(ByOrganizationId())
    @abc.abstractmethod
    def set_service_hook_projects(
        self,
        *,
        organization_id: int,
        installation: RpcSentryAppInstallation,
        project_identifiers: list[int | str],
        auth_context: AuthenticationContext,
    ) -> RpcServiceHookProjectsResult:
        """
        Replaces all service hook projects with the given project identifiers (either ID or slug).
        Accepts both due to a compatibility requirement with an active endpoint.
        Validates that the caller has access to all required projects.
        """
        pass

    @cell_rpc_method(ByOrganizationId())
    @abc.abstractmethod
    def delete_service_hook_projects(
        self,
        *,
        organization_id: int,
        installation: RpcSentryAppInstallation,
        auth_context: AuthenticationContext,
    ) -> RpcEmptyResult:
        """
        Deletes service hook projects for an installation.
        Validates that the caller has access to all required projects.
        """
        pass

    @cell_rpc_method(
        ByOrganizationIdAttribute(parameter_name="sentry_app", attribute_name="owner_id")
    )
    @abc.abstractmethod
    def get_interaction_stats(
        self,
        *,
        sentry_app: RpcSentryApp,
        component_types: list[str],
        since: float,
        until: float,
        resolution: int | None = None,
    ) -> RpcInteractionStatsResult:
        """Gets TSDB stats for Sentry App views and component interactions."""
        pass

    @cell_rpc_method(
        ByOrganizationIdAttribute(parameter_name="sentry_app", attribute_name="owner_id")
    )
    @abc.abstractmethod
    def record_interaction(
        self,
        *,
        sentry_app: RpcSentryApp,
        tsdb_field: str,
        component_type: str | None = None,
    ) -> RpcEmptyResult:
        """Records a TSDB metric for Sentry App interactions."""
        pass


sentry_app_cell_service = SentryAppCellService.create_delegation()
