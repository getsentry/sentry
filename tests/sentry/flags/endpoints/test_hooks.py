from django.urls import reverse

from sentry.flags.models import ACTION_MAP, CREATED_BY_TYPE_MAP, FlagAuditLogModel
from sentry.testutils.cases import APITestCase
from sentry.utils.security.orgauthtoken_token import hash_token


class OrganizationFlagsHooksEndpointTestCase(APITestCase):
    endpoint = "sentry-api-0-organization-flag-hooks"

    def setUp(self):
        super().setUp()
        self.url = reverse(self.endpoint, args=(self.organization.slug, "test"))

    def test_post(self):
        token = "sntrys_abc123_xyz"
        self.create_org_auth_token(
            name="Test Token 1",
            token_hashed=hash_token(token),
            organization_id=self.organization.id,
            token_last_characters="xyz",
            scope_list=["org:ci"],
            date_last_used=None,
        )

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    def test_launchdarkly_post(self):
        request_data = {
            "_links": {
                "property1": {"href": "string", "type": "string"},
                "property2": {"href": "string", "type": "string"},
            },
            "_id": "12345",
            "_accountId": "67890",
            "date": 1728680051000,
            "accesses": [{"action": "deleteFlag", "resource": "string"}],
            "kind": "string",
            "name": "Example Flag Name",
            "description": "Example, turning on the flag for testing",
            "shortDescription": "Example, turning on the flag",
            "comment": "This is an automated test",
            "subject": {
                "_links": {
                    "property1": {"href": "string", "type": "string"},
                    "property2": {"href": "string", "type": "string"},
                },
                "name": "string",
                "avatarUrl": "string",
            },
            "member": {
                "_links": {
                    "property1": {"href": "string", "type": "string"},
                    "property2": {"href": "string", "type": "string"},
                },
                "_id": "507f1f77bcf86cd799439011",
                "email": "jd@test.com",
                "firstName": "John",
                "lastName": "Doe",
            },
            "titleVerb": "turned on the flag",
        }

        token = "sntrys_abc123_xyz"
        self.create_org_auth_token(
            name="Test Token 1",
            token_hashed=hash_token(token),
            organization_id=self.organization.id,
            token_last_characters="xyz",
            scope_list=["org:ci"],
            date_last_used=None,
        )

        url = reverse(self.endpoint, args=(self.organization.slug, "launchdarkly"))

        response = self.client.post(
            url,
            request_data,
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )

        assert response.status_code == 200
        assert FlagAuditLogModel.objects.count() == 1
        flag = FlagAuditLogModel.objects.first()
        assert flag is not None
        assert flag.action == ACTION_MAP["deleted"]
        assert flag.flag == "Example Flag Name"
        assert flag.created_by == "jd@test.com"
        assert flag.created_by_type == CREATED_BY_TYPE_MAP["email"]
        assert flag.organization_id == self.organization.id
        assert flag.tags is not None
