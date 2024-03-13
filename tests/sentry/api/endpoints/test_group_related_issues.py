from django.urls import reverse

from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class RelatedIssuesTest(APITestCase):
    endpoint = "sentry-api-0-issues-related-issues"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.organization = self.create_organization(owner=self.user)

    def reverse_url(self):
        return reverse(self.endpoint, kwargs={"issue_id": 1})

    def test_authenticated_access_with_organization(self):
        self.create_group(data={"metadata": {"title": "title", "type": "error_type"}})
        response = self.get_success_response()
        assert response.json() == {"groups": [1]}
