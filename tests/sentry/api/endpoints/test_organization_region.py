from sentry.models.organization import Organization
from sentry.models.organizationmember import OrganizationMember
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import assume_test_silo_mode_of, control_silo_test, create_test_regions
from sentry.types.region import Region, get_region_by_name
from sentry.utils.security.orgauthtoken_token import generate_token, hash_token


@control_silo_test(regions=create_test_regions("us", "de"))
class OrganizationRegionTest(APITestCase):
    endpoint = "sentry-api-0-organization-region"

    def setUp(self):
        super().setUp()
        self.org_owner = self.create_user()
        us_region = get_region_by_name("us")
        self.org = self.create_organization(owner=self.org_owner, region=us_region)
        self.test_project = self.create_project(organization=self.org, name="test_project")

    def create_internal_integration_for_org(self, org, user, scopes: list[str]):
        internal_integration = self.create_internal_integration(organization=org, scopes=scopes)
        integration_token = self.create_internal_integration_token(
            internal_integration=internal_integration,
            user=user,
        )

        return (internal_integration, integration_token)

    def create_auth_token_for_org(self, org: Organization, region: Region, scopes: list[str]):
        org_auth_token_str = generate_token(org.slug, region.to_url(""))
        self.create_org_auth_token(
            organization_id=org.id,
            scope_list=scopes,
            name="test_token",
            token_hashed=hash_token(org_auth_token_str),
            date_last_used=None,
        )

        return org_auth_token_str

    def send_get_request_with_auth(self, org_slug: str, auth_token: str):
        return self.get_response(
            org_slug,
            extra_headers={
                "HTTP_AUTHORIZATION": f"Bearer {auth_token}",
            },
        )

    def test_org_member_has_access(self):
        self.login_as(self.org_owner)
        response = self.get_response(self.org.slug)

        assert response.status_code == 200
        us_region = get_region_by_name("us")
        assert response.data == {"url": us_region.to_url(""), "name": us_region.name}

    def test_non_org_member_has_no_access(self):
        non_member_user = self.create_user()
        self.login_as(non_member_user)
        response = self.get_response(self.org.slug)
        assert response.status_code == 403

    def test_org_auth_token_access_with_org_read(self):
        us_region = get_region_by_name("us")
        org_auth_token_str = self.create_auth_token_for_org(
            region=us_region, org=self.org, scopes=["org:ci"]
        )
        response = self.send_get_request_with_auth(self.org.slug, org_auth_token_str)

        us_region = get_region_by_name("us")
        assert response.data == {"url": us_region.to_url(""), "name": us_region.name}
        assert response.status_code == 200

    def test_org_auth_token_access_with_incorrect_scopes(self):
        us_region = get_region_by_name("us")
        org_auth_token_str = self.create_auth_token_for_org(
            region=us_region, org=self.org, scopes=[]
        )
        response = self.send_get_request_with_auth(self.org.slug, org_auth_token_str)

        assert response.status_code == 403

    def test_org_auth_token_access_for_different_organization(self):
        us_region = get_region_by_name("us")

        other_user = self.create_user()
        org_auth_token_str = self.create_auth_token_for_org(
            region=us_region, org=self.create_organization(owner=other_user), scopes=["org:ci"]
        )
        response = self.send_get_request_with_auth(self.org.slug, org_auth_token_str)

        assert response.status_code == 403

    def test_integration_token_access(self):
        integration, token = self.create_internal_integration_for_org(
            self.org, self.org_owner, ["project:read"]
        )

        response = self.send_get_request_with_auth(self.org.slug, token.token)

        assert response.status_code == 200
        us_region = get_region_by_name("us")
        assert response.data == {"name": us_region.name, "url": us_region.to_url("")}

    def test_integration_token_with_invalid_scopes(self):
        integration, token = self.create_internal_integration_for_org(self.org, self.org_owner, [])

        response = self.get_response(
            self.org.slug,
            extra_headers={
                "HTTP_AUTHORIZATION": f"Bearer {token.token}",
            },
        )
        assert response.status_code == 403

    def test_integration_for_different_organization(self):
        other_user = self.create_user()
        integration, token = self.create_internal_integration_for_org(
            self.create_organization(owner=other_user), other_user, ["project:read"]
        )

        response = self.send_get_request_with_auth(self.org.slug, token.token)
        assert response.status_code == 403

    def test_user_auth_token_for_owner(self):
        user_auth_token = self.create_user_auth_token(user=self.org_owner, scope_list=["org:read"])
        response = self.send_get_request_with_auth(self.org.slug, user_auth_token.token)

        assert response.status_code == 200
        us_region = get_region_by_name("us")
        assert response.data == {"url": us_region.to_url(""), "name": us_region.name}

    def test_user_auth_token_for_member(self):
        org_user = self.create_user()
        with assume_test_silo_mode_of(OrganizationMember):
            OrganizationMember.objects.create(
                user_id=org_user.id, organization_id=self.org.id, role="member"
            )

        user_auth_token = self.create_user_auth_token(user=org_user, scope_list=["org:read"])
        response = self.send_get_request_with_auth(self.org.slug, user_auth_token.token)

        assert response.status_code == 200
        us_region = get_region_by_name("us")
        assert response.data == {"url": us_region.to_url(""), "name": us_region.name}

    def test_user_auth_token_for_non_member(self):
        user_auth_token = self.create_user_auth_token(
            user=self.create_user(), scope_list=["org:read"]
        )
        response = self.send_get_request_with_auth(self.org.slug, user_auth_token.token)
        assert response.status_code == 403

    def test_user_auth_token_with_invalid_scopes(self):
        user_auth_token = self.create_user_auth_token(user=self.org_owner, scope_list=[])
        response = self.send_get_request_with_auth(self.org.slug, user_auth_token.token)

        assert response.status_code == 403

        user_auth_token = self.create_user_auth_token(
            user=self.org_owner, scope_list=["event:read"]
        )
        response = self.send_get_request_with_auth(self.org.slug, user_auth_token.token)

        assert response.status_code == 403
