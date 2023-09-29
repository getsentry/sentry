from django.urls import reverse

from sentry.models.environment import Environment
from sentry.models.release_threshold.release_threshold import ReleaseThreshold
from sentry.testutils.cases import APITestCase


class ReleaseThresholdTest(APITestCase):
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

        self.url = reverse(
            "sentry-api-0-project-release-thresholds",
            kwargs={"organization_slug": self.organization.slug, "project_slug": self.project.slug},
        )

    def test_post_missing_params(self):
        response = self.client.post(
            self.url,
            data={
                "threshold_type": "total_error_count",
                "trigger_type": "over",
                # value is missing
                "window_in_seconds": 1800,
                "environment": "canary",
            },
        )

        assert response.status_code == 400
        assert response.data == {"value": ["This field is required."]}

    def test_post_invalid_threshold_type(self):
        response = self.client.post(
            self.url,
            data={
                "threshold_type": "indiana_jones_and_the_temple_of_doom",
                "trigger_type": "over",
                "value": 100,
                "window_in_seconds": 1800,
                "environment": "canary",
            },
        )

        assert response.status_code == 400
        assert response.data["threshold_type"][0].code == "invalid_choice"

    def test_post_invalid_trigger_type(self):
        response = self.client.post(
            self.url,
            data={
                "threshold_type": "total_error_count",
                "trigger_type": "short_round",
                "value": 100,
                "window_in_seconds": 1800,
                "environment": "production",
            },
        )

        assert response.status_code == 400
        assert response.data["trigger_type"][0].code == "invalid_choice"

    def test_post_invalid_project(self):
        url_with_invalid_project = reverse(
            "sentry-api-0-project-release-thresholds",
            kwargs={
                "organization_slug": self.organization.slug,
                "project_slug": "Why did it have to be snakes?",
            },
        )
        response = self.client.post(
            url_with_invalid_project,
            data={
                "threshold_type": "total_error_count",
                "trigger_type": "over",
                "value": 100,
                "window_in_seconds": 1800,
                "environment": "production",
            },
        )
        assert response.status_code == 404

    def test_post_invalid_environment(self):
        response = self.client.post(
            self.url,
            data={
                "threshold_type": "total_error_count",
                "trigger_type": "over",
                "value": 100,
                "window_in_seconds": 1800,
                "environment": "Sentry belongs in a museum.",
            },
        )
        assert response.status_code == 400
        assert response.data["environment"][0].code == "invalid"

    def test_post_valid_no_environment(self):
        response = self.client.post(
            self.url,
            data={
                "threshold_type": "total_error_count",
                "trigger_type": "over",
                "value": 100,
                "window_in_seconds": 1800,
            },
        )
        assert response.status_code == 201
        data = response.data
        assert data["threshold_type"] == "total_error_count"
        assert data["trigger_type"] == "over"
        assert data["value"] == 100
        assert data["window_in_seconds"] == 1800
        assert data["project"]["id"] == str(self.project.id)
        assert data["project"]["slug"] == self.project.slug
        assert data["project"]["name"] == self.project.name
        assert data["environment"] is None
        assert data["date_added"] is not None

    def test_post_valid(self):
        response = self.client.post(
            self.url,
            data={
                "threshold_type": "total_error_count",
                "trigger_type": "over",
                "value": 100,
                "window_in_seconds": 1800,
                "environment": "canary",
            },
        )

        assert response.status_code == 201
        data = response.data
        assert data["threshold_type"] == "total_error_count"
        assert data["trigger_type"] == "over"
        assert data["value"] == 100
        assert data["window_in_seconds"] == 1800
        assert data["project"]["id"] == str(self.project.id)
        assert data["project"]["slug"] == self.project.slug
        assert data["project"]["name"] == self.project.name
        assert data["environment"]["id"] == str(self.canary_environment.id)
        assert data["environment"]["name"] == self.canary_environment.name
        assert data["date_added"] is not None

    def test_get_invalid_project(self):
        url_with_invalid_project = reverse(
            "sentry-api-0-project-release-thresholds",
            kwargs={
                "organization_slug": self.organization.slug,
                "project_slug": "Why did it have to be snakes?",
            },
        )
        response = self.client.get(url_with_invalid_project, data={"environment": "canary"})
        assert response.status_code == 404

    def test_get_invalid_environment(self):
        response = self.client.get(self.url, data={"environment": "The Hovitos are near"})
        assert response.status_code == 200
        assert len(response.data) == 0

    def test_get_valid_no_environment(self):
        response = self.client.get(self.url)
        assert response.status_code == 200
        assert len(response.data) == 0
        ReleaseThreshold.objects.create(
            threshold_type=0,
            trigger_type=0,
            value=100,
            window_in_seconds=1800,
            project=self.project,
            environment=self.canary_environment,
        )

        response = self.client.get(self.url)
        assert response.status_code == 200
        assert len(response.data) == 1

        created_threshold = response.data[0]

        assert created_threshold["threshold_type"] == "total_error_count"
        assert created_threshold["trigger_type"] == "over"
        assert created_threshold["value"] == 100
        assert created_threshold["window_in_seconds"] == 1800
        assert created_threshold["project"]["id"] == str(self.project.id)
        assert created_threshold["project"]["slug"] == self.project.slug
        assert created_threshold["project"]["name"] == self.project.name
        assert created_threshold["environment"]["id"] == str(self.canary_environment.id)
        assert created_threshold["environment"]["name"] == self.canary_environment.name

    def test_get_valid_with_environment(self):
        response = self.client.get(self.url, data={"environment": "canary"})
        assert response.status_code == 200
        assert len(response.data) == 0

        ReleaseThreshold.objects.create(
            threshold_type=0,
            trigger_type=0,
            value=100,
            window_in_seconds=1800,
            project=self.project,
            environment=self.canary_environment,
        )

        ReleaseThreshold.objects.create(
            threshold_type=0,
            trigger_type=1,
            value=100,
            window_in_seconds=1800,
            project=self.project,
            environment=self.production_environment,
        )

        response = self.client.get(self.url, data={"environment": "canary"})
        assert response.status_code == 200
        assert len(response.data) == 1

        created_threshold = response.data[0]

        assert created_threshold["threshold_type"] == "total_error_count"
        assert created_threshold["trigger_type"] == "over"
        assert created_threshold["value"] == 100
        assert created_threshold["window_in_seconds"] == 1800
        assert created_threshold["project"]["id"] == str(self.project.id)
        assert created_threshold["project"]["slug"] == self.project.slug
        assert created_threshold["project"]["name"] == self.project.name
        assert created_threshold["environment"]["id"] == str(self.canary_environment.id)
        assert created_threshold["environment"]["name"] == self.canary_environment.name
