from django.urls import reverse

from sentry.models.environment import Environment
from sentry.models.release_threshold.constants import THRESHOLD_TYPE_INT_TO_STR
from sentry.models.release_threshold.release_threshold import ReleaseThreshold
from sentry.testutils.cases import APITestCase


class ReleaseThresholdDetailsGETTest(APITestCase):
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
        assert response.data["trigger_type"] == "over"
        assert response.data["value"] == 100
        assert response.data["window_in_seconds"] == 1800


class ReleaseThresholdDetailsDELETETest(APITestCase):
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
        response = self.client.delete(url)

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
        response = self.client.delete(url)

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
        response = self.client.delete(url)

        assert response.status_code == 204


class ReleaseThresholdDetailsPUTTest(APITestCase):
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
        response = self.client.put(url)

        assert response.status_code == 404

    def test_invalid_missing_data(self):
        url = reverse(
            "sentry-api-0-project-release-thresholds-details",
            kwargs={
                "organization_slug": self.organization.slug,
                "project_slug": self.project.slug,
                "release_threshold": self.basic_threshold.id,
            },
        )
        data = {
            "project": self.basic_threshold.project.id,
            "environment": self.basic_threshold.environment.name,
            "id": self.basic_threshold.id,
        }
        response = self.client.put(url, data)
        assert response.status_code == 400

    def test_invalid_trigger_type(self):
        url = reverse(
            "sentry-api-0-project-release-thresholds-details",
            kwargs={
                "organization_slug": self.organization.slug,
                "project_slug": self.project.slug,
                "release_threshold": self.basic_threshold.id,
            },
        )
        data = {
            "project": self.basic_threshold.project.id,
            "environment": self.basic_threshold.environment.name,
            "id": self.basic_threshold.id,
            "trigger_type": "foobar",
            "threshold_type": THRESHOLD_TYPE_INT_TO_STR[self.basic_threshold.threshold_type],
            "value": 50,
            "window_in_seconds": 120,
        }
        response = self.client.put(url, data)
        assert response.status_code == 400

    def test_invalid_threshold_type(self):
        url = reverse(
            "sentry-api-0-project-release-thresholds-details",
            kwargs={
                "organization_slug": self.organization.slug,
                "project_slug": self.project.slug,
                "release_threshold": self.basic_threshold.id,
            },
        )
        data = {
            "project": self.basic_threshold.project.id,
            "environment": self.basic_threshold.environment.name,
            "id": self.basic_threshold.id,
            "trigger_type": "over",
            "threshold_type": "foobar",
            "value": 50,
            "window_in_seconds": 120,
        }
        response = self.client.put(url, data)
        assert response.status_code == 400

    def test_invalid_window(self):
        url = reverse(
            "sentry-api-0-project-release-thresholds-details",
            kwargs={
                "organization_slug": self.organization.slug,
                "project_slug": self.project.slug,
                "release_threshold": self.basic_threshold.id,
            },
        )
        data = {
            "project": self.basic_threshold.project.id,
            "environment": self.basic_threshold.environment.name,
            "id": self.basic_threshold.id,
            "trigger_type": "over",
            "threshold_type": THRESHOLD_TYPE_INT_TO_STR[self.basic_threshold.threshold_type],
            "value": 50,
            "window_in_seconds": -120,
        }
        response = self.client.put(url, data)
        assert response.status_code == 400

    def test_invalid_project(self):
        url = reverse(
            "sentry-api-0-project-release-thresholds-details",
            kwargs={
                "organization_slug": self.organization.slug,
                "project_slug": "kingdom_of_the_crystal_skull",
                "release_threshold": self.basic_threshold.id,
            },
        )
        response = self.client.put(url)

        assert response.status_code == 404

    def test_valid(self):
        updated_data = {
            "project": self.basic_threshold.project.id,
            "environment": self.basic_threshold.environment.name,
            "date_added": self.basic_threshold.date_added,
            "id": self.basic_threshold.id,
            "trigger_type": "under",
            "threshold_type": THRESHOLD_TYPE_INT_TO_STR[self.basic_threshold.threshold_type],
            "value": 50,
            "window_in_seconds": 120,
        }
        url = reverse(
            "sentry-api-0-project-release-thresholds-details",
            kwargs={
                "organization_slug": self.organization.slug,
                "project_slug": self.project.slug,
                "release_threshold": self.basic_threshold.id,
            },
        )
        response = self.client.put(url, data=updated_data)

        assert response.status_code == 200
        assert response.data["id"] == str(self.basic_threshold.id)
        assert response.data["threshold_type"] == "total_error_count"
        assert response.data["trigger_type"] == updated_data["trigger_type"]
        assert response.data["value"] == updated_data["value"]
        assert response.data["window_in_seconds"] == updated_data["window_in_seconds"]
        assert response.data["environment"]["name"] == "canary"

    def test_valid_with_extra_data(self):
        updated_data = {
            "project": self.basic_threshold.project.id,
            "environment": "foobar",
            "date_added": self.basic_threshold.date_added,
            "id": self.basic_threshold.id,
            "trigger_type": "under",
            "threshold_type": THRESHOLD_TYPE_INT_TO_STR[self.basic_threshold.threshold_type],
            "value": 50,
            "window_in_seconds": 120,
            "foo": "bar",
            "biz": "baz",
        }
        url = reverse(
            "sentry-api-0-project-release-thresholds-details",
            kwargs={
                "organization_slug": self.organization.slug,
                "project_slug": self.project.slug,
                "release_threshold": self.basic_threshold.id,
            },
        )
        response = self.client.put(url, data=updated_data)

        assert response.status_code == 200
        assert response.data["id"] == str(self.basic_threshold.id)
        assert response.data["threshold_type"] == "total_error_count"
        assert response.data["trigger_type"] == updated_data["trigger_type"]
        assert response.data["value"] == updated_data["value"]
        assert response.data["window_in_seconds"] == updated_data["window_in_seconds"]
        assert response.data["environment"]["name"] == "canary"
