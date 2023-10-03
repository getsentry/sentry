from sentry.hybridcloud.rpc_services.region_organization_provisioning import (
    region_organization_provisioning_rpc_service,
)
from sentry.models import Organization, OrganizationMember, OrganizationMemberTeam, Team, User
from sentry.services.organization import (
    OrganizationOptions,
    OrganizationProvisioningOptions,
    PostProvisionOptions,
)
from sentry.testutils.cases import TestCase


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
        org: Organization = Organization.objects.get(id=organization_id)
        assert org.slug == provisioning_options.provision_options.slug
        assert org.name == provisioning_options.provision_options.name
        assert org.get_default_owner().id == provisioning_options.provision_options.owning_user_id
        assert org.is_test == provisioning_options.provision_options.is_test

    def assert_has_default_team_and_membership(self, organization_id: int, user_id: int):
        org_membership = OrganizationMember.objects.get(
            organization_id=organization_id, user_id=user_id
        )
        team = Team.objects.get(organization_id=organization_id)
        OrganizationMemberTeam.objects.get(team_id=team.id, organizationmember_id=org_membership.id)

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
        assert not Organization.objects.filter(id=organization_id).exists()
