# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.
from abc import abstractmethod
from typing import Optional

from sentry.services.hybrid_cloud.organization import RpcOrganization
from sentry.services.hybrid_cloud.region import ByRegionName
from sentry.services.hybrid_cloud.rpc import RpcService, regional_rpc_method
from sentry.services.organization.model import OrganizationProvisioningOptions
from sentry.silo import SiloMode


class OrganizationProvisioningService(RpcService):
    key = "organization_provisioning"
    local_mode = SiloMode.REGION

    @regional_rpc_method(resolve=ByRegionName())
    @abstractmethod
    def provision_organization(
        self, *, region_name: str, org_provision_args: OrganizationProvisioningOptions
    ) -> RpcOrganization:
        """
        Provisions an organization, an organization member, and team based on the provisioning args passed.

        In the event of a slug conflict, a new slug will be generated using the provided slug as a seed.
        :param region_name: The region to provision the organization in.
        :param org_provision_args: Provisioning and post-provisioning options for the organization.
        :return: RpcOrganization containing a subset of the organization data.
        """
        pass

    @regional_rpc_method(resolve=ByRegionName())
    @abstractmethod
    def idempotent_provision_organization(
        self, *, region_name: str, org_provision_args: OrganizationProvisioningOptions
    ) -> Optional[RpcOrganization]:
        """
        Provisions an organization, an organization member, and team based on the provisioning args passed.

        In the event of a slug conflict, the conflicting org will be queried. If the provided owning_user_id
        matches the organization's owning user, the organization will be returned. Otherwise, None will be returned.

        Note: This is not intended to be used for normal organization provisioning; but rather, for use-cases
        such as integrations which require strong idempotency.
        :param region_name: The region to provision the organization in.
        :param org_provision_args: Provisioning and post-provisioning options for the organization.
        :return: RpcOrganization containing a subset of the organization data.
        """
        pass

    @classmethod
    def get_local_implementation(cls) -> RpcService:
        from sentry.services.hybrid_cloud.organization_provisioning.impl import (
            DatabaseBackedOrganizationProvisioningService,
        )

        return DatabaseBackedOrganizationProvisioningService()


organization_provisioning_service = OrganizationProvisioningService.create_delegation()
