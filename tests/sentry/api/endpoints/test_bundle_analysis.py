from django.urls import reverse

from sentry.models.apitoken import ApiToken
from sentry.silo import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import assume_test_silo_mode, region_silo_test
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
        self.url = reverse(
            "sentry-api-0-organization-bundle-size",
            kwargs={
                "organization_slug": self.organization.slug,
                "project_slug": self.project1.slug,
            },
        )
        self.data = {
            "stats": [
                {
                    "total_size": 210,
                    "javascript_size": 130,
                    "css_size": 20,
                    "fonts_size": 20,
                    "images_size": 40,
                    "bundle_name": "bundle_one",
                    "environment": "test",
                }
            ]
        }
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.token = ApiToken.objects.create(user=self.user, scope_list=["project:write"])

        self.login_as(user=self.user1)

    def test_raises_permission_denied_if_missing_feature(self):
        response = self.client.post(
            self.url,
            self.data,
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
        )
        assert response.status_code == 403

    def test_adds_metrics(self):
        with self.feature({"organizations:starfish-browser-resource-module-bundle-analysis": True}):
            response = self.client.post(
                self.url,
                self.data,
                HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
            )
            assert response.status_code == 200

    def test_fails_on_invalid_name(self):
        with self.feature({"organizations:starfish-browser-resource-module-bundle-analysis": True}):
            self.data["stats"][0]["bundle_name"] = "invalid!name"
            response = self.client.post(
                self.url,
                self.data,
                HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
            )
            assert response.status_code == 400
