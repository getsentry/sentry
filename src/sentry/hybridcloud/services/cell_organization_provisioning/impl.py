from django.db import IntegrityError, router, transaction
from django.db.models import Q
from sentry_sdk import capture_exception

from sentry import analytics, audit_log, roles
from sentry.analytics.events.data_consent_org_creation import (
    AggregatedDataConsentOrganizationCreatedEvent,
)
from sentry.analytics.events.organization_created import OrganizationCreatedEvent
from sentry.db.postgres.transactions import enforce_constraints
from sentry.hybridcloud.models.outbox import CellOutbox, outbox_context
from sentry.hybridcloud.outbox.category import OutboxCategory, OutboxScope
from sentry.hybridcloud.services.cell_organization_provisioning import (
    CellOrganizationProvisioningRpcService,
)
from sentry.hybridcloud.services.control_organization_provisioning import (
    RpcOrganizationSlugReservation,
)
from sentry.models.organization import ORGANIZATION_NAME_MAX_LENGTH, Organization
from sentry.models.organizationmember import OrganizationMember
from sentry.models.organizationmemberteam import OrganizationMemberTeam
from sentry.models.organizationslugreservation import OrganizationSlugReservationType
from sentry.services.organization import OrganizationOptions, OrganizationProvisioningOptions
from sentry.signals import terms_accepted
from sentry.users.services.user.model import RpcUser
from sentry.utils.audit import create_audit_entry_from_user


def create_post_provision_outbox(
    provisioning_options: OrganizationProvisioningOptions, org_id: int
) -> CellOutbox:
    return CellOutbox(
        shard_scope=OutboxScope.ORGANIZATION_SCOPE,
        shard_identifier=org_id,
        category=OutboxCategory.POST_ORGANIZATION_PROVISION,
        object_identifier=org_id,
        payload=provisioning_options.post_provision_options.dict(),
    )


class PreProvisionCheckException(Exception):
    pass


class DatabaseBackedCellOrganizationProvisioningRpcService(CellOrganizationProvisioningRpcService):
    def _create_organization_and_team(
        self,
        *,
        owner: RpcUser,
        organization_name: str,
        slug: str,
        create_default_team: bool,
        organization_id: int,
        is_test: bool = False,
    ) -> Organization:
        truncated_name = organization_name[:ORGANIZATION_NAME_MAX_LENGTH]
        org = Organization.objects.create(
            id=organization_id, name=truncated_name, slug=slug, is_test=is_test
        )
        # New organizations should not see the legacy UI
        org.update_option("sentry:streamline_ui_only", True)

        # Slug changes mean there was either a collision with the organization slug
        # or a bug in the slugify implementation, so we reject the organization creation
        assert org.slug == slug, "Organization slug should not have been modified on save"

        om = OrganizationMember.objects.create(
            user_id=owner.id, organization=org, role=roles.get_top_dog().id
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
        # Validate that no org with this org ID or slug exist in the cell, unless already
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
                    == provision_payload.provision_options.owner.id
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

    def create_organization_in_cell(
        self,
        *,
        cell_name: str,
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
                owner=provision_options.owner,
                slug=provision_options.slug,
                organization_name=provision_options.name,
                create_default_team=provision_options.create_default_team,
                organization_id=organization_id,
                is_test=provision_options.is_test,
            )

            create_post_provision_outbox(
                provisioning_options=provision_payload, org_id=organization.id
            ).save()

        self._record_organization_create_analytics(organization, provision_options)

        return True

    def _record_organization_create_analytics(
        self, organization: Organization, provision_options: OrganizationOptions
    ) -> None:
        # These operations involve RPC calls to control so do them outside of the transaction
        audit_data = organization.get_audit_log_data()
        actor_label = None
        if provision_options.channel_name:
            audit_data["channel"] = provision_options.channel_name
            actor_label = f"provision_channel:{provision_options.channel_name}"
        try:
            create_audit_entry_from_user(
                user=provision_options.owner,
                ip_address=provision_options.ip_address,
                organization=organization,
                target_object=organization.id,
                event=audit_log.get_event_id("ORG_ADD"),
                data=audit_data,
                actor_label=actor_label,
            )
        except Exception as e:
            capture_exception(e)

        try:
            analytics.record(
                OrganizationCreatedEvent(
                    id=organization.id,
                    name=organization.name,
                    slug=organization.slug,
                    actor_id=provision_options.owner.id,
                )
            )
        except Exception as e:
            capture_exception(e)

        if provision_options.agree_terms:
            terms_accepted.send_robust(
                user=provision_options.owner,
                organization_id=organization.id,
                ip_address=provision_options.ip_address,
                sender=type(self),
            )

        if provision_options.aggregated_data_consent:
            organization.update_option("sentry:aggregated_data_consent", True)
            try:
                analytics.record(
                    AggregatedDataConsentOrganizationCreatedEvent(organization_id=organization.id)
                )
            except Exception as e:
                capture_exception(e)

    def update_organization_slug_from_reservation(
        self,
        *,
        cell_name: str,
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
            #  on the cell side
            capture_exception(e)
            return False
