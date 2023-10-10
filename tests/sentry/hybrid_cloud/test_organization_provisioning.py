from typing import Optional

from sentry import roles
from sentry.models.organization import Organization
from sentry.models.organizationmapping import OrganizationMapping
from sentry.models.organizationmember import OrganizationMember
from sentry.models.organizationslugreservation import OrganizationSlugReservation
from sentry.models.outbox import OutboxCategory, RegionOutbox, outbox_context
from sentry.models.user import User
from sentry.services.hybrid_cloud.organization import RpcOrganization
from sentry.services.hybrid_cloud.organization_provisioning import organization_provisioning_service
from sentry.services.organization import (
    OrganizationOptions,
    OrganizationProvisioningOptions,
    PostProvisionOptions,
)
from sentry.silo import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import all_silo_test, assume_test_silo_mode


def get_default_org_provisioning_options(user: User, org_name: str, org_slug: str):
    return OrganizationProvisioningOptions(
        provision_options=OrganizationOptions(
            name=org_name,
            slug=org_slug,
            owning_user_id=user.id,
        ),
        post_provision_options=PostProvisionOptions(getsentry_options=None, sentry_options=None),
    )


def assert_params_match_org(
    provisioning_options: OrganizationProvisioningOptions, org: RpcOrganization
):
    with assume_test_silo_mode(SiloMode.REGION):
        db_org: Organization = Organization.objects.get(id=org.id)
    assert org.slug == db_org.slug == provisioning_options.provision_options.slug
    assert org.name == db_org.name == provisioning_options.provision_options.name

    with assume_test_silo_mode(SiloMode.CONTROL):
        org_mapping: OrganizationMapping = OrganizationMapping.objects.get(organization_id=org.id)
        assert org_mapping.slug == db_org.slug
        assert org_mapping.name == db_org.name
        assert org_mapping.status == db_org.status

        org_slug_reservation = OrganizationSlugReservation.objects.get(
            organization_id=org.id, slug=db_org.slug
        )
        assert org_slug_reservation.user_id == -1


def is_org_member(user_id: int, org_id: int):
    with assume_test_silo_mode(SiloMode.REGION):
        return OrganizationMember.objects.filter(user_id=user_id, organization_id=org_id).exists()


def is_org_owner(user_id: int, org_id: int):
    with assume_test_silo_mode(SiloMode.REGION):
        org_members = OrganizationMember.objects.filter(user_id=user_id, organization_id=org_id)
    return len(org_members) == 1 and org_members[0].role == roles.get_top_dog().id


def assert_post_install_outbox_created(
    provisioning_options: OrganizationProvisioningOptions, org: RpcOrganization
):
    with assume_test_silo_mode(SiloMode.REGION):
        outbox_message = RegionOutbox.objects.get(
            shard_identifier=org.id, category=OutboxCategory.POST_ORGANIZATION_PROVISION
        )

    assert outbox_message.object_identifier == org.id
    post_provision_args = PostProvisionOptions.parse_obj(outbox_message.payload)
    assert post_provision_args == provisioning_options.post_provision_options


@all_silo_test(stable=True)
class TestOrganizationProvisioningService(TestCase):
    def test_organization_provision__happy_path(self):

        user = self.create_user()
        org_args = get_default_org_provisioning_options(
            user=user, org_name="santry", org_slug="santry"
        )

        with outbox_context(flush=False):
            results: RpcOrganization = organization_provisioning_service.provision_organization(
                region_name="us", org_provision_args=org_args
            )

        assert_post_install_outbox_created(org=results, provisioning_options=org_args)

        with outbox_runner():
            pass
        assert_params_match_org(org=results, provisioning_options=org_args)

    def test_organization_slug_collision_without_exact_slug_required(self):
        user = self.create_user()
        org_args = get_default_org_provisioning_options(
            user=user, org_name="santry", org_slug="santry"
        )
        # Create a conflicting org owned by a different user
        self.create_organization(slug="santry", name="santry", owner=self.create_user())

        results: RpcOrganization = organization_provisioning_service.provision_organization(
            region_name="us", org_provision_args=org_args
        )

        assert results
        assert "santry" in results.slug
        org_args.provision_options.slug = results.slug
        assert_params_match_org(provisioning_options=org_args, org=results)


@all_silo_test(stable=True)
class TestIdempotentProvisionOrganization(TestCase):
    def test_organization_provision__happy_path(self):
        user = self.create_user(email="test@example.com")
        org_args = get_default_org_provisioning_options(
            user=user, org_name="santry", org_slug="santry"
        )

        with outbox_context(flush=False):
            results: Optional[
                RpcOrganization
            ] = organization_provisioning_service.idempotent_provision_organization(
                region_name="us", org_provision_args=org_args
            )

        assert results
        assert_post_install_outbox_created(org=results, provisioning_options=org_args)

        with outbox_runner():
            pass

        assert_params_match_org(org=results, provisioning_options=org_args)

    def test_organization_slug_collision_with_non_member_user(self):
        user = self.create_user(email="test@example.com")
        org_args = get_default_org_provisioning_options(
            user=user, org_name="santry", org_slug="santry"
        )
        # Create a conflicting org owned by a different user
        with outbox_runner():
            unowned_org = self.create_organization(
                slug="santry", name="santry", owner=self.create_user()
            )

        assert not is_org_member(user_id=user.id, org_id=unowned_org.id)

        with assume_test_silo_mode(SiloMode.REGION):
            orgs_before_rpc = list(Organization.objects.filter())

        results: Optional[
            RpcOrganization
        ] = organization_provisioning_service.idempotent_provision_organization(
            region_name="us", org_provision_args=org_args
        )

        with assume_test_silo_mode(SiloMode.REGION):
            orgs_after_rpc = list(Organization.objects.filter())
        assert len(orgs_before_rpc) == len(orgs_after_rpc)

        assert results is None

    def test_organization_idempotent_org_creation(self):
        user = self.create_user(email="test@example.com")
        org_args = get_default_org_provisioning_options(
            user=user, org_name="santry", org_slug="santry"
        )

        owned_org = self.create_organization(slug="santry", name="santry", owner=user)

        assert is_org_owner(user_id=user.id, org_id=owned_org.id)

        with outbox_context(flush=False):
            results: Optional[
                RpcOrganization
            ] = organization_provisioning_service.idempotent_provision_organization(
                region_name="us", org_provision_args=org_args
            )

        assert results
        with outbox_runner():
            pass

        assert_params_match_org(org=results, provisioning_options=org_args)

    def test_non_owner_attempts_idempotent_org_creation(self):
        user = self.create_user(email="test@example.com")
        org_args = get_default_org_provisioning_options(
            user=user, org_name="santry", org_slug="santry"
        )

        org: Organization = self.create_organization(
            slug="santry", name="santry", owner=self.create_user()
        )

        with assume_test_silo_mode(SiloMode.REGION):
            OrganizationMember.objects.create(
                user_id=user.id, organization_id=org.id, role=roles.get_default()
            )

        assert is_org_member(user_id=user.id, org_id=org.id)
        assert not is_org_owner(user_id=user.id, org_id=org.id)

        with outbox_context(flush=False):
            results: Optional[
                RpcOrganization
            ] = organization_provisioning_service.idempotent_provision_organization(
                region_name="us", org_provision_args=org_args
            )

        assert results is None
