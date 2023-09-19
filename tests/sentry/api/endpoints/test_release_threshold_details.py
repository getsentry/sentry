from django.urls import reverse

from sentry.models.environment import Environment
from sentry.models.release_threshold.release_threshold import ReleaseThreshold
from sentry.testutils.cases import APITestCase


class ReleaseThresholdDetailsTest(APITestCase):
    def setUp(self):
        super().setUp()
        self.user = self.create_user(is_staff=True, is_superuser=True)

        self.canary_environment = Environment.objects.create(
            organization_id=self.organization.id, name="canary"
        )
        self.production_environment = Environment.objects.create(
            organization_id=self.organization.id, name="production"
        )
        self.login_as(user=self.user)

        self.basic_threshold = ReleaseThreshold.objects.create(
            threshold_type=0,
            trigger_type=0,
            value=100,
            window_in_seconds=1800,
            project=self.project,
            environment=self.canary_environment,
        )

    def test_invalid_threshold_id(self):
        url = reverse(
            "sentry-api-0-project-release-thresholds-details",
            kwargs={
                "organization_slug": self.organization.slug,
                "project_slug": self.project.slug,
                "release_threshold": 123,
            },
        )
        response = self.client.get(url)

        assert response.status_code == 404

    def test_invalid_project(self):
        url = reverse(
            "sentry-api-0-project-release-thresholds-details",
            kwargs={
                "organization_slug": self.organization.slug,
                "project_slug": "kingdom_of_the_crystal_skull",
                "release_threshold": self.basic_threshold.id,
            },
        )
        response = self.client.get(url)

        assert response.status_code == 404

    def test_valid(self):
        url = reverse(
            "sentry-api-0-project-release-thresholds-details",
            kwargs={
                "organization_slug": self.organization.slug,
                "project_slug": self.project.slug,
                "release_threshold": self.basic_threshold.id,
            },
        )
        response = self.client.get(url)

        assert response.status_code == 200
        assert response.data["id"] == str(self.basic_threshold.id)
        assert response.data["threshold_type"] == "total_error_count"
        assert response.data["trigger_type"] == "percent_over"
        assert response.data["value"] == 100
        assert response.data["window_in_seconds"] == 1800
        assert response.data["environment"]["name"] == "canary"
