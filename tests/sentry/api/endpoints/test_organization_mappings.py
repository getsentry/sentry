from sentry.models.organizationmapping import OrganizationMapping
from sentry.testutils import APITestCase
from sentry.testutils.silo import control_silo_test


class OrganizationIndexTest(APITestCase):
    endpoint = "sentry-api-0-organization-mappings"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)


@control_silo_test(stable=True)
class OrganizationMappingsCreateTest(OrganizationIndexTest):
    method = "post"

    def test_missing_params(self):
        self.get_error_response(status_code=400)

    def test_valid_params(self):
        data = {
            "slug": "foobar",
            "organization_id": 1234567,
            "stripe_id": "blah",
            "idempotency_key": "blah",
            "region_name": "de",
        }
        response = self.get_success_response(**data)
        mapping = OrganizationMapping.objects.get(slug=response.data["slug"])
        assert mapping.organization_id == data["organization_id"]
        assert mapping.slug == data["slug"]
        assert mapping.stripe_id == data["stripe_id"]
        assert not mapping.verified

    def test_valid_double_submit(self):
        data = {
            "slug": "foobar1",
            "organization_id": 1234567,
            "stripe_id": "blah",
            "idempotency_key": "key",
            "region_name": "de",
        }
        OrganizationMapping.objects.create(**data)
        response = self.get_success_response(
            **{**data, "organization_id": 7654321, "region_name": "tz"}
        )
        assert response.data["id"]
        assert response.data["organization_id"] == "7654321"
        assert response.data["region_name"] == "tz"

    def test_dupe_slug_reservation(self):
        basedata = {
            "slug": "foobar",
            "organization_id": 1234567,
            "stripe_id": "blah",
            "region_name": "de",
        }
        data1 = {**basedata, "idempotency_key": "key1"}
        OrganizationMapping.objects.create(**data1)
        data2 = {**basedata, "idempotency_key": "key2"}
        self.get_error_response(status_code=409, **data2)
