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
            "organizationId": 1234567,
            "customerId": "blah",
            "idempotencyKey": "blah",
            "regionName": "de",
        }
        response = self.get_success_response(**data)
        mapping = OrganizationMapping.objects.get(slug=response.data["slug"])
        assert mapping.organization_id == data["organizationId"]
        assert mapping.slug == data["slug"]
        assert mapping.customer_id == data["customerId"]
        assert not mapping.verified

    def test_valid_double_submit(self):
        data = {
            "slug": "foobar1",
            "organizationId": 1234567,
            "customerId": "blah",
            "idempotencyKey": "key",
            "regionName": "de",
        }
        OrganizationMapping.objects.create(**data)
        response = self.get_success_response(
            **{**data, "organizationId": 7654321, "region_name": "tz"}
        )
        assert response.data["id"]
        assert response.data["organizationId"] == "7654321"
        assert response.data["regionName"] == "tz"

    def test_dupe_slug_reservation(self):
        modeldata = {
            "slug": "foobar",
            "organization_id": 1234567,
            "customer_id": "blah",
            "region_name": "de",
        }
        data1 = {**modeldata, "idempotency_key": "key1"}
        OrganizationMapping.objects.create(**data1)
        data2 = {**modeldata, "idempotency_key": "key2"}
        self.get_error_response(status_code=409, **data2)
