from typing import Optional

from django.db import IntegrityError, router, transaction
from sentry_sdk import capture_exception

from sentry import roles
from sentry.models.organization import Organization
from sentry.models.organizationmember import OrganizationMember
from sentry.models.outbox import OutboxCategory, OutboxScope, RegionOutbox, outbox_context
from sentry.services.hybrid_cloud.organization import RpcOrganization
from sentry.services.hybrid_cloud.organization.serial import serialize_rpc_organization
from sentry.services.hybrid_cloud.organization_actions.impl import (
    create_organization_and_member_for_monolith,
)
from sentry.services.hybrid_cloud.organization_provisioning import OrganizationProvisioningService
from sentry.services.organization import OrganizationProvisioningOptions


class SlugMismatchException(Exception):
    pass


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


class InvalidOrganizationProvisioningSlugQueryException(Exception):
    pass


class DatabaseBackedOrganizationProvisioningService(OrganizationProvisioningService):
    def _validate_organization_belongs_to_user(
        self, user_id: int, organization: RpcOrganization
    ) -> bool:
        top_dog_id = roles.get_top_dog().id
        try:
            org_member = OrganizationMember.objects.get(
                organization_id=organization.id, user_id=user_id
            )
            return top_dog_id == org_member.role
        except OrganizationMember.DoesNotExist:
            return False

    def provision_organization(
        self, *, region_name: str, org_provision_args: OrganizationProvisioningOptions
    ) -> RpcOrganization:
        provision_options = org_provision_args.provision_options
        with outbox_context(transaction.atomic(router.db_for_write(Organization))):
            org_creation_result = create_organization_and_member_for_monolith(
                user_id=provision_options.owning_user_id,
                slug=provision_options.slug,
                organization_name=provision_options.name,
                create_default_team=provision_options.create_default_team,
                is_test=provision_options.is_test,
            )

            org = org_creation_result.organization
            create_post_provision_outbox(
                provisioning_options=org_provision_args, org_id=org.id
            ).save()

            return serialize_rpc_organization(org)

    def idempotent_provision_organization(
        self, *, region_name: str, org_provision_args: OrganizationProvisioningOptions
    ) -> Optional[RpcOrganization]:
        sentry_org_options = org_provision_args.provision_options
        try:
            assert (
                org_provision_args.provision_options.owning_user_id
            ), "An owning user ID must be provided when provisioning an idempotent organization"

            with outbox_context(transaction.atomic(router.db_for_write(Organization))):
                org = self.provision_organization(
                    region_name=region_name, org_provision_args=org_provision_args
                )

                if org.slug != sentry_org_options.slug:
                    raise SlugMismatchException(
                        f"Expected slug to be {sentry_org_options.slug}, received {org.slug}"
                    )

                return org
        except (IntegrityError, SlugMismatchException):
            # We've collided with another organization slug and can't fully
            #  provision the org, so we rollback the insert and validate
            #  whether the provided user ID owns the existing organization.
            existing_organization = Organization.objects.filter(
                slug=org_provision_args.provision_options.slug
            )

            if existing_organization.count() == 1 and self._validate_organization_belongs_to_user(
                user_id=sentry_org_options.owning_user_id, organization=existing_organization[0]
            ):
                return serialize_rpc_organization(existing_organization[0])

            if existing_organization.count() > 1:
                capture_exception(
                    InvalidOrganizationProvisioningSlugQueryException(
                        f"Too many organizations ({existing_organization.count()})"
                        + " were returned when checking for idempotency"
                    )
                )
            else:
                capture_exception(
                    InvalidOrganizationProvisioningSlugQueryException(
                        "No organization was found when validating an organization collision"
                        + f" for slug '{org_provision_args.provision_options.slug}'"
                    )
                )
            return None
