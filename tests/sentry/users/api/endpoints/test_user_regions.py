from sentry.testutils.cases import APITestCase
from sentry.testutils.region import override_regions
from sentry.testutils.silo import control_silo_test
from sentry.types.region import Region, RegionCategory

us = Region("us", 1, "https://us.testserver", RegionCategory.MULTI_TENANT)
de = Region("de", 2, "https://de.testserver", RegionCategory.MULTI_TENANT)
st = Region("acme", 3, "https://acme.testserver", RegionCategory.SINGLE_TENANT)
region_config = (us, de, st)


@control_silo_test
class UserUserRolesTest(APITestCase):
    endpoint = "sentry-api-0-user-regions"

    def setUp(self):
        super().setUp()
        self.user = self.create_user()

    @override_regions(region_config)
    def test_get(self):
        self.login_as(user=self.user)
        self.create_organization(region="us", owner=self.user)
        self.create_organization(region="de", owner=self.user)
        self.create_organization(region="acme", owner=self.user)

        response = self.get_response("me")
        assert response.status_code == 200
        assert "regions" in response.data
        assert response.data["regions"] == [
            st.api_serialize(),
            de.api_serialize(),
            us.api_serialize(),
        ]

    @override_regions(region_config)
    def test_get_only_memberships(self):
        self.login_as(user=self.user)
        other = self.create_user()
        self.create_organization(region="acme", owner=other)
        self.create_organization(region="de", owner=self.user)

        response = self.get_response("me")
        assert response.status_code == 200
        assert "regions" in response.data
        assert response.data["regions"] == [de.api_serialize()]

    @override_regions(region_config)
    def test_get_other_user_error(self):
        self.login_as(user=self.user)
        other = self.create_user()
        self.create_organization(region="acme", owner=other)

        response = self.get_response(other.id)
        assert response.status_code == 403

    @override_regions(region_config)
    def test_allow_superuser_to_query_all(self):
        superuser = self.create_user(is_superuser=True)
        self.login_as(user=superuser, superuser=True)

        test_user_1 = self.create_user()
        self.create_organization(region="us", owner=test_user_1)
        self.create_organization(region="de", owner=test_user_1)
        self.create_organization(region="acme", owner=test_user_1)

        test_user_2 = self.create_user()
        response = self.get_response(test_user_1.id)
        assert response.status_code == 200
        assert "regions" in response.data
        assert response.data["regions"] == [
            st.api_serialize(),
            de.api_serialize(),
            us.api_serialize(),
        ]

        response = self.get_response(test_user_2.id)
        assert response.status_code == 200
        assert "regions" in response.data
        assert response.data["regions"] == []

    @override_regions(region_config)
    def test_get_for_user_with_auth_token(self):
        self.create_organization(region="us", owner=self.user)
        self.create_organization(region="de", owner=self.user)
        auth_token = self.create_user_auth_token(user=self.user, scope_list=["org:read"])
        response = self.get_success_response(
            "me", extra_headers={"HTTP_AUTHORIZATION": f"Bearer {auth_token}"}
        )
        assert "regions" in response.data
        assert response.data["regions"] == [de.api_serialize(), us.api_serialize()]

    @override_regions(region_config)
    def test_get_other_user_with_auth_token_error(self):
        other_user = self.create_user()
        self.create_organization(region="us", owner=other_user)
        self.create_organization(region="de", owner=other_user)

        auth_token = self.create_user_auth_token(user=self.user, scope_list=["org:read"])
        self.get_error_response(
            other_user.id,
            extra_headers={"HTTP_AUTHORIZATION": f"Bearer {auth_token}"},
            status_code=403,
        )

    @override_regions(region_config)
    def test_get_for_user_with_wrong_scopes_error(self):
        self.create_organization(region="us", owner=self.user)
        self.create_organization(region="de", owner=self.user)

        auth_token = self.create_user_auth_token(user=self.user, scope_list=["project:read"])
        self.get_error_response(
            "me", extra_headers={"HTTP_AUTHORIZATION": f"Bearer {auth_token}"}, status_code=403
        )

    @override_regions(region_config)
    def test_get_for_user_with_no_auth(self):
        self.create_organization(region="us", owner=self.user)
        self.create_organization(region="de", owner=self.user)

        self.get_error_response("me", status_code=401)
        self.get_error_response(self.user.id, status_code=401)
