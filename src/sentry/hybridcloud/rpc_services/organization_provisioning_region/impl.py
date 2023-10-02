from django.db import IntegrityError, router, transaction
from django.db.models import Q
from sentry_sdk import capture_exception

from sentry import roles
from sentry.db.postgres.transactions import enforce_constraints
from sentry.hybridcloud.rpc_services.organization_provisioning import RpcOrganizationSlugReservation
from sentry.hybridcloud.rpc_services.organization_provisioning_region import (
    OrganizationProvisioningRegionService,
)
from sentry.models import (
    Organization,
    OrganizationMember,
    OrganizationMemberTeam,
    OrganizationSlugReservationType,
    OutboxCategory,
    OutboxScope,
    RegionOutbox,
    outbox_context,
)
from sentry.services.organization import OrganizationProvisioningOptions


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

    def _pre_prevision_organization_check(
        self,
        organization_id: int,
        provision_payload: OrganizationProvisioningOptions,
    ) -> bool:
        provision_request_valid = True
        slug = provision_payload.provision_options.slug
        # Validate that no org with this org ID or slug exist in the region, unless already
        #  owned by the user_id
        matching_organizations_qs = Organization.objects.filter(
            Q(id=organization_id) | Q(slug=slug)
        )
        if matching_organizations_qs.exists():
            assert (
                matching_organizations_qs.count() == 1
            ), "Multiple conflicting organization returned when provisioning an organization"

            matching_org: Organization = matching_organizations_qs.first()
            provisioning_user_is_org_owner = (
                matching_org.get_default_owner().id
                == provision_payload.provision_options.owning_user_id
            )

            # Idempotency check in case a previous outbox completed partially
            #  and created an org for the user
            org_slug_matches_provision_options = (
                matching_org.slug == provision_payload.provision_options.slug
            )
            provision_request_valid = (
                provisioning_user_is_org_owner and org_slug_matches_provision_options
            )

            return provision_request_valid

        if not provision_request_valid:
            capture_exception(
                Exception(
                    f"Regional provision check failed for org_id ({organization_id}) slug ({slug})"
                )
            )

        return provision_request_valid

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

    def update_organization_slug_from_reservation(
        self,
        region_name: str,
        org_slug_temporary_alias_res: RpcOrganizationSlugReservation,
    ) -> bool:
        # Skip any non-primary organization slug updates
        assert (
            org_slug_temporary_alias_res.reservation_type
            == OrganizationSlugReservationType.TEMPORARY_RENAME_ALIAS.value
        ), "Organization slugs can only be updated from temporary aliases"

        try:
            with enforce_constraints(transaction.atomic(using=router.db_for_write(Organization))):
                org_qs = Organization.objects.filter(
                    id=org_slug_temporary_alias_res.organization_id
                )
                if not org_qs.exists():
                    # The org either hasn't been provisioned yet, or was recently deleted.
                    return False

                assert (
                    org_qs.count() == 1
                ), "Only 1 Organization should be affected by a slug change"

                org = org_qs.first()

                if org.slug != org_slug_temporary_alias_res.slug:
                    org.update(slug=org_slug_temporary_alias_res.slug)

            return True
        except IntegrityError as e:
            # We hit a slug collision here and cannot accept the new slug
            #  on the region side
            capture_exception(e)
            return False
