from copy import deepcopy
from typing import List, Optional, Set, Tuple

from django.db import router, transaction

from sentry import roles
from sentry.constants import RESERVED_ORGANIZATION_SLUGS
from sentry.db.models.utils import slugify_instance
from sentry.hybridcloud.rpc_services.control_organization_provisioning import (
    ControlOrganizationProvisioningRpcService,
    RpcOrganizationSlugReservation,
    serialize_slug_reservation,
)
from sentry.models.organizationmapping import OrganizationMapping
from sentry.models.organizationmember import OrganizationMember
from sentry.models.organizationmembermapping import OrganizationMemberMapping
from sentry.models.organizationslugreservation import (
    OrganizationSlugReservation,
    OrganizationSlugReservationType,
)
from sentry.models.outbox import (
    ControlOutbox,
    OutboxCategory,
    OutboxScope,
    RegionOutbox,
    outbox_context,
)
from sentry.services.hybrid_cloud.organization import RpcOrganization
from sentry.services.organization import OrganizationProvisioningOptions
from sentry.utils.snowflake import generate_snowflake_id


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


def create_organization_provisioning_outbox(
    organization_id: int,
    region_name: str,
    org_provision_payload: Optional[OrganizationProvisioningOptions],
):
    payload = org_provision_payload.json() if org_provision_payload is not None else None
    return ControlOutbox(
        region_name=region_name,
        shard_scope=OutboxScope.PROVISION_SCOPE,
        category=OutboxCategory.PROVISION_ORGANIZATION,
        shard_identifier=organization_id,
        object_identifier=organization_id,
        payload=payload,
    )


class InvalidOrganizationProvisioningException(Exception):
    pass


REDIS_KEY_PREFIX = "control_org"


class DatabaseBackedControlOrganizationProvisioningService(
    ControlOrganizationProvisioningRpcService
):
    @staticmethod
    def _validate_organization_belongs_to_user(user_id: int, organization: RpcOrganization) -> bool:
        top_dog_id = roles.get_top_dog().id
        try:
            org_member = OrganizationMember.objects.get(
                organization_id=organization.id, user_id=user_id
            )
            return top_dog_id == org_member.role
        except OrganizationMember.DoesNotExist:
            return False

    @staticmethod
    def _validate_organization_mapping_belongs_to_user(
        user_id: int, organization_mapping: OrganizationMapping
    ) -> bool:
        top_dog_id = roles.get_top_dog().id
        try:
            org_member = OrganizationMemberMapping.objects.get(
                organization_id=organization_mapping.organization_id, user_id=user_id
            )
            return top_dog_id == org_member.role
        except OrganizationMemberMapping.DoesNotExist:
            return False

    @staticmethod
    def _generate_org_snowflake_id(region_name: str) -> int:
        redis_key = f"{REDIS_KEY_PREFIX}_{region_name}"
        return generate_snowflake_id(redis_key)

    @staticmethod
    def _generate_org_slug(region_name: str, slug: str) -> str:
        slug_base = slug.replace("_", "-").strip("-")
        surrogate_org_slug = OrganizationSlugReservation()
        slugify_instance(surrogate_org_slug, slug_base, reserved=RESERVED_ORGANIZATION_SLUGS)

        return surrogate_org_slug.slug

    @staticmethod
    def _get_slug_reservation_for_organization(
        organization_id: int, reservation_type: OrganizationSlugReservationType
    ) -> Optional[OrganizationSlugReservation]:
        try:
            slug_res = OrganizationSlugReservation.objects.get(
                organization_id=organization_id, reservation_type=reservation_type
            )
            return slug_res
        except OrganizationSlugReservation.DoesNotExist:
            return None

    @staticmethod
    def _get_slug_reservation_by_type_from_list(
        org_slug_reservations: List[OrganizationSlugReservation],
        reservation_type: OrganizationSlugReservationType,
    ) -> Optional[OrganizationSlugReservation]:
        return next(
            (
                slug_res
                for slug_res in org_slug_reservations
                if slug_res.reservation_type == reservation_type.value
            ),
            None,
        )

    def provision_organization(
        self, *, region_name: str, org_provision_args: OrganizationProvisioningOptions
    ) -> RpcOrganizationSlugReservation:
        # Generate a new non-conflicting slug and org ID
        org_id = self._generate_org_snowflake_id(region_name=region_name)
        slug = self._generate_org_slug(
            region_name=region_name, slug=org_provision_args.provision_options.slug
        )

        # Generate a provisioning outbox for the region and drain
        updated_provision_options = deepcopy(org_provision_args.provision_options)
        updated_provision_options.slug = slug
        provision_payload = OrganizationProvisioningOptions(
            provision_options=updated_provision_options,
            post_provision_options=org_provision_args.post_provision_options,
        )

        with outbox_context(
            transaction.atomic(using=router.db_for_write(OrganizationSlugReservation))
        ):
            # TODO @GabeVillalobos: add email/user_id pair to be able to check for idempotency
            org_slug_res = OrganizationSlugReservation(
                slug=slug,
                organization_id=org_id,
                user_id=org_provision_args.provision_options.owning_user_id,
                region_name=region_name,
            )

            org_slug_res.save(unsafe_write=True)
            create_organization_provisioning_outbox(
                organization_id=org_id,
                region_name=region_name,
                org_provision_payload=provision_payload,
            ).save()

        # After outboxes resolve, ensure that the organization slug still exists.
        # If it was deleted, the provisioning failed for some reason.

        org_slug_requery = OrganizationSlugReservation.objects.get(id=org_slug_res.id)

        assert (
            org_slug_requery.slug == org_slug_res.slug
            and org_slug_requery.organization_id == org_slug_res.organization_id
        ), "Organization slug reservation does not match after provisioning the org"

        return serialize_slug_reservation(org_slug_res)

    def idempotent_provision_organization(
        self, *, region_name: str, org_provision_args: OrganizationProvisioningOptions
    ) -> Optional[RpcOrganizationSlugReservation]:
        raise NotImplementedError()

    def update_organization_slug(
        self,
        *,
        region_name: str,
        organization_id: int,
        desired_slug: str,
        require_exact: bool = True,
    ) -> RpcOrganizationSlugReservation:
        existing_slug_reservations = list(
            OrganizationSlugReservation.objects.filter(organization_id=organization_id)
        )

        existing_temporary_alias = self._get_slug_reservation_by_type_from_list(
            org_slug_reservations=existing_slug_reservations,
            reservation_type=OrganizationSlugReservationType.TEMPORARY_RENAME_ALIAS,
        )

        if existing_temporary_alias:
            raise Exception("Cannot change an organization slug while another swap is in progress")

        existing_primary_alias = self._get_slug_reservation_by_type_from_list(
            org_slug_reservations=existing_slug_reservations,
            reservation_type=OrganizationSlugReservationType.PRIMARY,
        )

        # If there's already a matching primary slug reservation for the org,
        # just replicate it to the region to kick off the organization sync process
        if existing_primary_alias and existing_primary_alias.slug == desired_slug:
            existing_primary_alias.handle_async_replication(region_name, organization_id)
            return serialize_slug_reservation(existing_primary_alias)

        slug_base = desired_slug
        if not require_exact:
            slug_base = self._generate_org_slug(region_name=region_name, slug=slug_base)

        with outbox_context(
            transaction.atomic(using=router.db_for_write(OrganizationSlugReservation))
        ):
            OrganizationSlugReservation(
                slug=slug_base,
                organization_id=organization_id,
                user_id=-1,
                region_name=region_name,
                reservation_type=OrganizationSlugReservationType.TEMPORARY_RENAME_ALIAS.value,
            ).save(unsafe_write=True)

        primary_slug = self._validate_primary_slug_updated(
            organization_id=organization_id, slug_base=slug_base
        )

        return serialize_slug_reservation(primary_slug)

    def _validate_primary_slug_updated(
        self, organization_id: int, slug_base: str
    ) -> OrganizationSlugReservation:
        primary_slug = self._get_slug_reservation_for_organization(
            organization_id=organization_id,
            reservation_type=OrganizationSlugReservationType.PRIMARY,
        )

        if not primary_slug or primary_slug.slug != slug_base:
            raise InvalidOrganizationProvisioningException(
                "Failed to swap slug for organization, likely due to conflict on the region"
            )

        return primary_slug

    def bulk_create_organization_slug_reservations(
        self, *, region_name: str, organization_ids_and_slugs: Set[Tuple[int, str]]
    ) -> None:
        slug_reservations_to_create: List[OrganizationSlugReservation] = []

        with outbox_context(transaction.atomic(router.db_for_write(OrganizationSlugReservation))):
            for org_id, slug in organization_ids_and_slugs:
                slug_reservation = OrganizationSlugReservation(
                    slug=self._generate_org_slug(slug=slug, region_name=region_name),
                    organization_id=org_id,
                    reservation_type=OrganizationSlugReservationType.TEMPORARY_RENAME_ALIAS.value,
                    user_id=-1,
                    region_name=region_name,
                )
                slug_reservation.save(unsafe_write=True)

                slug_reservations_to_create.append(slug_reservation)

        for slug_reservation in slug_reservations_to_create:
            self._validate_primary_slug_updated(
                slug_base=slug_reservation.slug, organization_id=slug_reservation.organization_id
            )
