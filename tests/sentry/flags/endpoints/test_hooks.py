from django.urls import reverse

from sentry.testutils.cases import APITestCase
from sentry.utils.security.orgauthtoken_token import hash_token


class OrganizationFlagsHooksEndpointTestCase(APITestCase):
    endpoint = "sentry-api-0-organization-flag-hooks"
    provider = "test"

    def setUp(self):
        super().setUp()
        self.url = reverse(self.endpoint, args=(self.organization.slug, self.provider))

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
