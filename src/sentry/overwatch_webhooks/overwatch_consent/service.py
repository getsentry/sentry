# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from typing import int
from abc import abstractmethod

from sentry.hybridcloud.rpc.resolvers import ByRegionName
from sentry.hybridcloud.rpc.service import RpcService, regional_rpc_method
from sentry.overwatch_webhooks.overwatch_consent.model import RpcOrganizationConsentStatus
from sentry.silo.base import SiloMode


class OverwatchConsentService(RpcService):
    key = "overwatch_consent"
    local_mode = SiloMode.REGION

    @classmethod
    def get_local_implementation(cls) -> RpcService:
        from sentry.overwatch_webhooks.overwatch_consent.impl import (
            DatabaseBackedOverwatchConsentService,
        )

        return DatabaseBackedOverwatchConsentService()

    @regional_rpc_method(resolve=ByRegionName())
    @abstractmethod
    def get_organization_consent_status(
        self, *, organization_ids: list[int], region_name: str
    ) -> dict[int, RpcOrganizationConsentStatus]:
        """
        Get consent status for multiple organizations in a region.

        :param organization_ids: List of organization IDs to check
        :param region_name: The region name
        :return: Dictionary mapping organization ID to consent status
        """
        pass


overwatch_consent_service = OverwatchConsentService.create_delegation()
