from django.urls import reverse

# from sentry.models import Group
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class OrganizationRelatedIssuesTest(APITestCase):
    endpoint = "sentry-api-0-organization-related-issues"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.organization = self.create_organization(owner=self.user)

    def reverse_url(self):
        return reverse(self.endpoint, kwargs={"organization_slug": self.organization.slug})

    def test_authenticated_access_with_organization(self):
        response = self.get_success_response()
        assert response.json() == []
