from sentry.testutils.cases import APITestCase
from sentry.testutils.region import override_regions
from sentry.testutils.silo import control_silo_test
from sentry.types.region import Region, RegionCategory

us = Region("us", 1, "https://us.testserver", RegionCategory.MULTI_TENANT)
de = Region("de", 2, "https://de.testserver", RegionCategory.MULTI_TENANT)
st = Region("acme", 3, "https://acme.testserver", RegionCategory.SINGLE_TENANT)
region_config = (us, de, st)


@control_silo_test(stable=True)
class UserUserRolesTest(APITestCase):
    endpoint = "sentry-api-0-user-regions"

    def setUp(self):
        super().setUp()
        self.user = self.create_user()
        self.login_as(user=self.user)

    @override_regions(region_config)
    def test_get(self):
        self.create_organization(region="us", owner=self.user)
        self.create_organization(region="de", owner=self.user)
        self.create_organization(region="acme", owner=self.user)

        response = self.get_response("me")
        assert response.status_code == 200
        assert "regions" in response.data
        assert len(response.data["regions"]) == 3
        assert us.api_serialize() in response.data["regions"]
        assert de.api_serialize() in response.data["regions"]
        assert st.api_serialize() in response.data["regions"]

    @override_regions(region_config)
    def test_get_only_memberships(self):
        other = self.create_user()
        self.create_organization(region="acme", owner=other)
        self.create_organization(region="de", owner=self.user)

        response = self.get_response("me")
        assert response.status_code == 200
        assert "regions" in response.data
        assert len(response.data["regions"]) == 1
        assert response.data["regions"][0] == de.api_serialize()

    @override_regions(region_config)
    def test_get_other_user_error(self):
        other = self.create_user()
        self.create_organization(region="acme", owner=other)

        response = self.get_response(other.id)
        assert response.status_code == 403
