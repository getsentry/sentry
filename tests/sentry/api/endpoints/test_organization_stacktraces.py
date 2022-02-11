from django.urls import reverse

from sentry.models import ApiToken
from sentry.testutils import APITestCase


class OrganizationStacktracesTest(APITestCase):

    endpoints = (
        ("sentry-api-0-organization-stacktraces",),
        ("sentry-api-0-organization-stacktrace-filters",),
    )

    def send_get_request(self, token, endpoint, *args):
        url = reverse(endpoint, args=(self.project.organization.slug,) + args)
        return self.client.get(url, HTTP_AUTHORIZATION=f"Bearer {token.token}", format="json")

    def test_feature_flag_disabled(self):
        token = ApiToken.objects.create(user=self.user, scope_list=["org:read"])

        for endpoint in self.endpoints:
            response = self.send_get_request(token, *endpoint)
            assert response.status_code == 404
