from django.db import router, transaction
from django.db.models import Q
from sentry_sdk import capture_exception

from sentry import roles
from sentry.hybridcloud.rpc_services.organization_provisioning import (
    OrganizationProvisioningOptions,
)
from sentry.hybridcloud.rpc_services.organization_provisioning_region import (
    OrganizationProvisioningRegionService,
)
from sentry.models import (
    Organization,
    OrganizationMember,
    OrganizationMemberTeam,
    OutboxCategory,
    OutboxScope,
    RegionOutbox,
    outbox_context,
)


def create_post_provision_outbox(
    provisioning_options: OrganizationProvisioningOptions, org_id: int
):
    return RegionOutbox(
        shard_scope=OutboxScope.ORGANIZATION_SCOPE,
        shard_identifier=org_id,
        category=OutboxCategory.POST_ORGANIZATION_PROVISION,
        object_identifier=org_id,
        payload=provisioning_options.post_provision_options.json(),
    )


class DatabaseBackedOrganizationProvisioningRegionService(OrganizationProvisioningRegionService):
    def _create_organization_and_team(
        self,
        organization_name: str,
        user_id: int,
        slug: str,
        create_default_team: bool,
        organization_id: int,
        is_test: bool = False,
    ) -> Organization:
        org = Organization.objects.create(
            id=organization_id, name=organization_name, slug=slug, is_test=is_test
        )

        om = OrganizationMember.objects.create(
            user_id=user_id, organization=org, role=roles.get_top_dog().id
        )

        team = None
        if create_default_team:
            team = org.team_set.create(name=org.name)
            OrganizationMemberTeam.objects.create(team=team, organizationmember=om, is_active=True)

        return org

    def create_organization_in_region(
        self,
        region_name: str,
        organization_id: int,
        provision_payload: OrganizationProvisioningOptions,
    ) -> bool:
        if not self._pre_prevision_organization_check(
            organization_id=organization_id, provision_payload=provision_payload
        ):
            return False
        provision_options = provision_payload.provision_options

        with outbox_context(transaction.atomic(router.db_for_write(Organization))):
            org_creation_result = self._create_organization_and_team(
                user_id=provision_options.owning_user_id,
                slug=provision_options.slug,
                organization_name=provision_options.name,
                create_default_team=provision_options.create_default_team,
                organization_id=organization_id,
            )

            org = org_creation_result
            create_post_provision_outbox(
                provisioning_options=provision_payload, org_id=org.id
            ).save()

        return True

    def _pre_prevision_organization_check(
        self,
        organization_id: int,
        provision_payload: OrganizationProvisioningOptions,
    ) -> bool:
        provision_request_valid = True
        slug = provision_payload.provision_options.slug
        # Validate that no org with this org ID or slug exist in the region
        matching_organization = Organization.objects.filter(Q(id=organization_id) | Q(slug=slug))
        if matching_organization.exists():
            provision_request_valid = False

        if not provision_request_valid:
            capture_exception(
                Exception(
                    f"Regional provision check failed for org_id ({organization_id}) slug ({slug})"
                )
            )

        return provision_request_valid
