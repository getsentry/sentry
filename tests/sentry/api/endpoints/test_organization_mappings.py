from sentry.models.organizationmapping import OrganizationMapping
from sentry.testutils import APITestCase


class OrganizationIndexTest(APITestCase):
    endpoint = "sentry-api-0-organization-mappings"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)


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
        }
        OrganizationMapping.objects.create(**data)
        response = self.get_success_response(**data)
        assert response.data["created"]

    def test_dupe_slug_reservation(self):
        basedata = {"slug": "foobar", "organization_id": 1234567, "stripe_id": "blah"}
        data1 = {**basedata, "idempotency_key": "key1"}
        OrganizationMapping.objects.create(**data1)
        data2 = {**basedata, "idempotency_key": "key2"}
        self.get_error_response(status_code=409, **data2)
