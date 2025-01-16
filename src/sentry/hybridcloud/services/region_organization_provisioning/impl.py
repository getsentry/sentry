from django.db import IntegrityError, router, transaction
from django.db.models import Q
from sentry_sdk import capture_exception

from sentry import roles
from sentry.db.postgres.transactions import enforce_constraints
from sentry.hybridcloud.models.outbox import RegionOutbox, outbox_context
from sentry.hybridcloud.outbox.category import OutboxCategory, OutboxScope
from sentry.hybridcloud.services.control_organization_provisioning import (
    RpcOrganizationSlugReservation,
)
from sentry.hybridcloud.services.region_organization_provisioning import (
    RegionOrganizationProvisioningRpcService,
)
from sentry.issues.streamline import apply_streamline_rollout_group
from sentry.models.organization import Organization
from sentry.models.organizationmember import OrganizationMember
from sentry.models.organizationmemberteam import OrganizationMemberTeam
from sentry.models.organizationslugreservation import OrganizationSlugReservationType
from sentry.services.organization import OrganizationProvisioningOptions


def create_post_provision_outbox(
    provisioning_options: OrganizationProvisioningOptions, org_id: int
) -> RegionOutbox:
    return RegionOutbox(
        shard_scope=OutboxScope.ORGANIZATION_SCOPE,
        shard_identifier=org_id,
        category=OutboxCategory.POST_ORGANIZATION_PROVISION,
        object_identifier=org_id,
        payload=provisioning_options.post_provision_options.dict(),
    )


class PreProvisionCheckException(Exception):
    pass


class DatabaseBackedRegionOrganizationProvisioningRpcService(
    RegionOrganizationProvisioningRpcService
):
    def _create_organization_and_team(
        self,
        organization_name: str,
        slug: str,
        create_default_team: bool,
        organization_id: int,
        is_test: bool = False,
        user_id: int | None = None,
        email: str | None = None,
    ) -> Organization:
        assert (user_id is None and email) or (
            user_id and email is None
        ), "Must set either user_id or email"
        org = Organization.objects.create(
            id=organization_id, name=organization_name, slug=slug, is_test=is_test
        )

        apply_streamline_rollout_group(organization=org)

        # Slug changes mean there was either a collision with the organization slug
        # or a bug in the slugify implementation, so we reject the organization creation
        assert org.slug == slug, "Organization slug should not have been modified on save"

        om = (
            OrganizationMember.objects.create(
                user_id=user_id, organization=org, role=roles.get_top_dog().id
            )
            if user_id
            else OrganizationMember.objects.create(
                email=email, organization=org, role=roles.get_top_dog().id
            )
        )

        if create_default_team:
            team = org.team_set.create(name=org.name)
            OrganizationMemberTeam.objects.create(team=team, organizationmember=om, is_active=True)

        return org

    def _get_previously_provisioned_org_and_validate(
        self,
        organization_id: int,
        provision_payload: OrganizationProvisioningOptions,
    ) -> Organization | None:
        slug = provision_payload.provision_options.slug
        # Validate that no org with this org ID or slug exist in the region, unless already
        #  owned by the user_id
        matching_organizations_qs = Organization.objects.filter(
            Q(id=organization_id) | Q(slug=slug)
        )

        if matching_organizations_qs.exists():
            if matching_organizations_qs.count() > 1:
                raise PreProvisionCheckException("Multiple conflicting organizations found")

            matching_org = matching_organizations_qs.get()

            try:
                provisioning_user_is_org_owner = (
                    matching_org.get_default_owner().id
                    == provision_payload.provision_options.owning_user_id
                )
            except IndexError:
                # get_default_owner raises this when the org has no default owner
                raise PreProvisionCheckException(
                    "A conflicting organization with no owner was found"
                )

            if not provisioning_user_is_org_owner:
                raise PreProvisionCheckException(
                    "A conflicting organization with a different owner was found"
                )

            # Idempotency check in case a previous outbox completed partially
            #  and created an org for the user
            org_slug_matches_provision_options = (
                matching_org.slug == provision_payload.provision_options.slug
                and matching_org.id == organization_id
            )

            if not org_slug_matches_provision_options:
                raise PreProvisionCheckException(
                    "A partially conflicting org with either a matching slug or ID was found"
                )

            # If none of the previous validations failed, then we have a match for a previously provisioned org
            return matching_org
        return None

    def create_organization_in_region(
        self,
        region_name: str,
        organization_id: int,
        provision_payload: OrganizationProvisioningOptions,
    ) -> bool:
        try:
            if (
                self._get_previously_provisioned_org_and_validate(
                    organization_id=organization_id, provision_payload=provision_payload
                )
                is not None
            ):
                # The organization was previously provisioned already, no need to do more work
                return True
        except PreProvisionCheckException:
            capture_exception()
            return False

        provision_options = provision_payload.provision_options

        with outbox_context(transaction.atomic(router.db_for_write(Organization))):
            organization = self._create_organization_and_team(
                user_id=provision_options.owning_user_id,
                email=provision_options.owning_email,
                slug=provision_options.slug,
                organization_name=provision_options.name,
                create_default_team=provision_options.create_default_team,
                organization_id=organization_id,
                is_test=provision_options.is_test,
            )

            create_post_provision_outbox(
                provisioning_options=provision_payload, org_id=organization.id
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
                org = Organization.objects.get(id=org_slug_temporary_alias_res.organization_id)
                org.update(slug=org_slug_temporary_alias_res.slug)

            return True
        except (IntegrityError, Organization.DoesNotExist) as e:
            # We hit a slug collision here and cannot accept the new slug
            #  on the region side
            capture_exception(e)
            return False
