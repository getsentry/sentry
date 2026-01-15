# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

import abc
from typing import Any

from sentry.hybridcloud.rpc.resolvers import ByOrganizationId
from sentry.hybridcloud.rpc.service import RpcService, regional_rpc_method
from sentry.sentry_apps.services.app import RpcSentryAppInstallation
from sentry.sentry_apps.services.region.model import (
    RpcEmptyResult,
    RpcPlatformExternalIssueResult,
    RpcSelectRequesterResult,
    RpcServiceHookProjectsResult,
)
from sentry.silo.base import SiloMode
from sentry.users.services.user import RpcUser


class SentryAppRegionService(RpcService):
    """
    Region silo service for Sentry App operations that require access to region-specific data
    (like projects, issues, etc.).

    Enables control silo endpoints to perform operations that access or modify region silo data
    without creating a bunch of services and RPC calls.
    """

    key = "sentry_app_region"
    local_mode = SiloMode.REGION

    @classmethod
    def get_local_implementation(cls) -> RpcService:
        from sentry.sentry_apps.services.region.impl import DatabaseBackedSentryAppRegionService

        return DatabaseBackedSentryAppRegionService()

    @regional_rpc_method(ByOrganizationId())
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

    @regional_rpc_method(ByOrganizationId())
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

    @regional_rpc_method(ByOrganizationId())
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

    @regional_rpc_method(ByOrganizationId())
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

    @regional_rpc_method(ByOrganizationId())
    @abc.abstractmethod
    def get_service_hook_projects(
        self,
        *,
        organization_id: int,
        installation: RpcSentryAppInstallation,
    ) -> RpcServiceHookProjectsResult:
        """Returns the project IDs associated with an installation's service hook."""
        pass

    @regional_rpc_method(ByOrganizationId())
    @abc.abstractmethod
    def set_service_hook_projects(
        self,
        *,
        organization_id: int,
        installation: RpcSentryAppInstallation,
        project_ids: list[int],
    ) -> RpcServiceHookProjectsResult:
        """Replaces all service hook projects with the given project IDs."""
        pass

    @regional_rpc_method(ByOrganizationId())
    @abc.abstractmethod
    def delete_service_hook_projects(
        self,
        *,
        organization_id: int,
        installation: RpcSentryAppInstallation,
    ) -> RpcEmptyResult:
        """Deletes all service hook projects for an installation."""
        pass


sentry_app_region_service = SentryAppRegionService.create_delegation()
