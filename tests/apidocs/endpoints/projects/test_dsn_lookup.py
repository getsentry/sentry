from urllib.parse import urlencode

from django.test.client import RequestFactory
from django.urls import reverse

from fixtures.apidocs_test_case import APIDocsTestCase


class DsnLookupDocsTest(APIDocsTestCase):
    def setUp(self) -> None:
        key = self.project.key_set.get()
        self.url = reverse(
            "sentry-api-0-organization-dsn-lookup",
            kwargs={"organization_id_or_slug": self.organization.slug},
        )
        self.url = f"{self.url}?{urlencode({'dsn': key.dsn_public})}"
        self.login_as(user=self.user)

    def test_get(self) -> None:
        response = self.client.get(self.url)
        assert response.status_code == 200, response.content
        request = RequestFactory().get(self.url)

        self.validate_schema(request, response)
