from typing import Optional

from django.conf import settings
from django.db import IntegrityError, router, transaction

from sentry.models import Organization
from sentry.services.hybrid_cloud.organization_provisioning import OrganizationProvisioningOptions
from sentry.services.hybrid_cloud.organization_provisioning import (
    organization_provisioning_service as rpc_org_provisioning_service,
)


class OrganizationSlugCollisionException(Exception):
    pass


class OrganizationProvisioningService:
    def provision_organization_in_region(
        self, provisioning_options: OrganizationProvisioningOptions, region_name: Optional[str]
    ):
        """
        Provisions an organization in the provided region. If no region is
        provided, the default monolith region is assumed.

        This method is fairly slim at the moment, solely because it's acting
        as a proxy for the underlying RPC service. There will be more
        provisioning logic added when this is made multi-region safe.

        :param provisioning_options: The organization provisioning and post-
        provisioning options
        :param region_name: The region name to provision the organization in.
        :return: RPCOrganization
        """
        if region_name is None:
            region_name = settings.SENTRY_MONOLITH_REGION

        rpc_org = rpc_org_provisioning_service.provision_organization(
            region_name=region_name, org_provision_args=provisioning_options
        )

        return rpc_org

    def idempotent_provision_organization_in_region(
        self, provisioning_options: OrganizationProvisioningOptions, region_name: Optional[str]
    ):
        raise NotImplementedError()

    def modify_organization_slug(self, organization_id: int, slug: str):
        """
        Updates an organization with the given slug if available.

         This is currently database backed, but will be switched to be
         RPC based in the near future.
        :param organization_id:
        :param slug:
        :return:
        """
        try:
            with transaction.atomic(using=router.db_for_write(Organization)):
                organization = Organization.objects.get(id=organization_id)
                organization.slug = slug
                organization.save()
        except IntegrityError:
            raise OrganizationSlugCollisionException()


organization_provisioning_service = OrganizationProvisioningService()
