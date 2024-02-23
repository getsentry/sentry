from django.urls import reverse

from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]


@region_silo_test
class BundleAnalysisEndpoint(APITestCase):
    def setUp(self):
        super().setUp()
        self.user1 = self.create_user(is_staff=False, is_superuser=False)

        self.organization.save()
        self.team1 = self.create_team(organization=self.organization)
        self.project1 = self.create_project(teams=[self.team1], organization=self.organization)

    def test_raises_permission_denied_if_missing_feature(self):
        url = reverse(
            "sentry-api-0-organization-bundle-size",
            kwargs={
                "organization_slug": self.organization.slug,
                "project_slug": self.project1.slug,
            },
        )
        response = self.client.post(url)
        assert response.status_code == 403
