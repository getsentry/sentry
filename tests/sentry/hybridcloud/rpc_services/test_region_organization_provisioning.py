from django.db import router, transaction

from sentry.hybridcloud.rpc_services.control_organization_provisioning import (
    RpcOrganizationSlugReservation,
)
from sentry.hybridcloud.rpc_services.region_organization_provisioning import (
    region_organization_provisioning_rpc_service,
)
from sentry.models.organization import Organization
from sentry.models.organizationmember import OrganizationMember
from sentry.models.organizationmemberteam import OrganizationMemberTeam
from sentry.models.organizationslugreservation import (
    OrganizationSlugReservation,
    OrganizationSlugReservationType,
)
from sentry.models.outbox import outbox_context
from sentry.models.team import Team
from sentry.models.user import User
from sentry.services.organization import (
    OrganizationOptions,
    OrganizationProvisioningOptions,
    PostProvisionOptions,
)
from sentry.silo import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test, create_test_regions


@control_silo_test(regions=create_test_regions("us"))
class TestRegionOrganizationProvisioningCreateInRegion(TestCase):
    def get_provisioning_args(
        self, user: User, is_test: bool = False, create_default_team: bool = True
    ) -> OrganizationProvisioningOptions:
        return OrganizationProvisioningOptions(
            provision_options=OrganizationOptions(
                name="Santry",
                slug="santry",
                owning_user_id=user.id,
                is_test=is_test,
                create_default_team=create_default_team,
            ),
            post_provision_options=PostProvisionOptions(),
        )

    def organization_matches_provisioning_args(
        self, organization_id: int, provisioning_options: OrganizationProvisioningOptions
    ):
        with assume_test_silo_mode(SiloMode.REGION):
            org: Organization = Organization.objects.get(id=organization_id)
            assert org.slug == provisioning_options.provision_options.slug
            assert org.name == provisioning_options.provision_options.name
            assert (
                org.get_default_owner().id == provisioning_options.provision_options.owning_user_id
            )
        assert org.is_test == provisioning_options.provision_options.is_test

    def assert_has_default_team_and_membership(self, organization_id: int, user_id: int):
        with assume_test_silo_mode(SiloMode.REGION):
            org_membership = OrganizationMember.objects.get(
                organization_id=organization_id, user_id=user_id
            )
            team = Team.objects.get(organization_id=organization_id)
            OrganizationMemberTeam.objects.get(
                team_id=team.id, organizationmember_id=org_membership.id
            )

    def test_provisions_when_no_conflicting_orgs(self):
        user = self.create_user()
        provision_options = self.get_provisioning_args(user)
        organization_id = 42
        result = region_organization_provisioning_rpc_service.create_organization_in_region(
            organization_id=organization_id, provision_payload=provision_options, region_name="us"
        )

        assert result
        self.organization_matches_provisioning_args(
            organization_id=organization_id, provisioning_options=provision_options
        )
        self.assert_has_default_team_and_membership(organization_id, user.id)

    def test_provisions_test_org_without_default_team(self):
        user = self.create_user()
        provision_options = self.get_provisioning_args(user, create_default_team=False)
        organization_id = 42
        result = region_organization_provisioning_rpc_service.create_organization_in_region(
            organization_id=organization_id, provision_payload=provision_options, region_name="us"
        )

        assert result
        self.organization_matches_provisioning_args(
            organization_id=organization_id, provisioning_options=provision_options
        )

        with assume_test_silo_mode(SiloMode.REGION):
            assert not Team.objects.filter(organization_id=organization_id).exists()

    def test_provisions_when_fully_conflicting_org_has_matching_owner(self):
        user = self.create_user()
        organization_id = 42
        existing_org = self.create_organization(
            id=organization_id, slug="santry", name="Santry", owner=user
        )
        assert existing_org.id == organization_id

        provision_options = self.get_provisioning_args(user, create_default_team=False)
        result = region_organization_provisioning_rpc_service.create_organization_in_region(
            organization_id=organization_id, provision_payload=provision_options, region_name="us"
        )

        assert result
        self.organization_matches_provisioning_args(
            organization_id=organization_id, provisioning_options=provision_options
        )

    def test_does_not_provision_and_returns_false_when_multiple_orgs_conflict(self):
        organization_id = 42
        # Org with a matching id
        self.create_organization(
            id=organization_id, slug="newsantry", name="NewSantry", owner=self.create_user()
        )

        # Org with a matching slug
        self.create_organization(slug="santry", name="Santry", owner=self.create_user())

        provisioning_user = self.create_user()
        provision_options = self.get_provisioning_args(provisioning_user, create_default_team=False)
        result = region_organization_provisioning_rpc_service.create_organization_in_region(
            organization_id=organization_id, provision_payload=provision_options, region_name="us"
        )

        assert not result

        with assume_test_silo_mode(SiloMode.REGION):
            # Ensure that the user has not been added to any orgs since provisioning failed
            provisioning_user_memberships = OrganizationMember.objects.filter(
                user_id=provisioning_user.id
            )
        assert not provisioning_user_memberships.exists()

    def test_does_not_provision_and_returns_false_when_conflicting_org_with_different_owner(self):
        organization_id = 42
        self.create_organization(
            id=organization_id, slug="santry", name="Santry", owner=self.create_user()
        )

        provisioning_user = self.create_user()
        provision_options = self.get_provisioning_args(provisioning_user)
        result = region_organization_provisioning_rpc_service.create_organization_in_region(
            organization_id=organization_id, provision_payload=provision_options, region_name="us"
        )

        assert not result

        with assume_test_silo_mode(SiloMode.REGION):
            provisioning_user_memberships = OrganizationMember.objects.filter(
                user_id=provisioning_user.id
            )
        assert not provisioning_user_memberships.exists()

    def test_does_not_provision_when_organization_id_already_in_use(
        self,
    ):
        organization_id = 42
        user = self.create_user()
        self.create_organization(
            id=organization_id, slug="something-different", name="Santry", owner=user
        )

        provision_options = self.get_provisioning_args(user)
        result = region_organization_provisioning_rpc_service.create_organization_in_region(
            organization_id=organization_id, provision_payload=provision_options, region_name="us"
        )

        assert not result
        with assume_test_silo_mode(SiloMode.REGION):
            assert not Organization.objects.filter(
                slug=provision_options.provision_options.slug
            ).exists()

    def test_does_not_provision_when_organization_slug_already_in_use(
        self,
    ):
        organization_id = 42
        user = self.create_user()
        self.create_organization(slug="santry", name="Santry", owner=user)

        provision_options = self.get_provisioning_args(user)
        result = region_organization_provisioning_rpc_service.create_organization_in_region(
            organization_id=organization_id, provision_payload=provision_options, region_name="us"
        )

        assert not result

        with assume_test_silo_mode(SiloMode.REGION):
            assert not Organization.objects.filter(id=organization_id).exists()


@control_silo_test(regions=create_test_regions("us"))
class TestRegionOrganizationProvisioningUpdateOrganizationSlug(TestCase):
    def setUp(self):
        self.provisioning_user = self.create_user()
        self.provisioned_org = self.create_organization(
            name="Santry", slug="santry", owner=self.provisioning_user
        )

    def create_temporary_slug_res(self, organization: Organization, slug: str, region: str):
        with assume_test_silo_mode(SiloMode.CONTROL), outbox_context(
            transaction.atomic(router.db_for_write(OrganizationSlugReservation))
        ):
            OrganizationSlugReservation(
                reservation_type=OrganizationSlugReservationType.TEMPORARY_RENAME_ALIAS,
                slug=slug,
                organization_id=organization.id,
                region_name=region,
                user_id=-1,
            ).save(unsafe_write=True)

    def create_rpc_organization_slug_reservation(self, slug: str) -> RpcOrganizationSlugReservation:
        return RpcOrganizationSlugReservation(
            id=7,
            slug=slug,
            organization_id=self.provisioned_org.id,
            user_id=self.provisioning_user.id,
            region_name="us",
            reservation_type=OrganizationSlugReservationType.TEMPORARY_RENAME_ALIAS.value,
        )

    def test_updates_org_slug_when_no_conflicts(self):
        desired_slug = "new-santry"
        # We have to create a temporary slug reservation in order for org mapping drains to proceed
        self.create_temporary_slug_res(
            organization=self.provisioned_org, region="us", slug=desired_slug
        )
        result = (
            region_organization_provisioning_rpc_service.update_organization_slug_from_reservation(
                region_name="us",
                org_slug_temporary_alias_res=self.create_rpc_organization_slug_reservation(
                    desired_slug
                ),
            )
        )

        assert result
        with assume_test_silo_mode(SiloMode.REGION):
            updated_org = Organization.objects.get(id=self.provisioned_org.id)
        assert updated_org.slug == desired_slug

    def test_returns_true_if_organization_slug_already_updated(self):
        result = (
            region_organization_provisioning_rpc_service.update_organization_slug_from_reservation(
                region_name="us",
                org_slug_temporary_alias_res=self.create_rpc_organization_slug_reservation(
                    self.provisioned_org.slug
                ),
            )
        )

        assert result
        with assume_test_silo_mode(SiloMode.REGION):
            updated_org = Organization.objects.get(id=self.provisioned_org.id)
        assert updated_org.slug == self.provisioned_org.slug

    def test_fails_if_organization_not_found(self):
        rpc_org_slug_res = self.create_rpc_organization_slug_reservation("new-santry")
        with assume_test_silo_mode(SiloMode.REGION):
            self.provisioned_org.delete()

        result = (
            region_organization_provisioning_rpc_service.update_organization_slug_from_reservation(
                region_name="us",
                org_slug_temporary_alias_res=rpc_org_slug_res,
            )
        )

        assert not result
        with assume_test_silo_mode(SiloMode.REGION):
            assert not Organization.objects.filter(slug="new-santry").exists()

    def test_does_not_update_slug_when_conflict_exists(self):
        desired_slug = "new-sentry"
        self.create_organization(slug=desired_slug, name="conflicted org", owner=self.create_user())
        result = (
            region_organization_provisioning_rpc_service.update_organization_slug_from_reservation(
                region_name="us",
                org_slug_temporary_alias_res=self.create_rpc_organization_slug_reservation(
                    desired_slug
                ),
            )
        )

        assert not result
        with assume_test_silo_mode(SiloMode.REGION):
            org = Organization.objects.get(id=self.provisioned_org.id)
        assert org.slug == self.provisioned_org.slug
