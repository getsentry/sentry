from django.urls import reverse

from sentry.models.environment import Environment
from sentry.testutils.cases import APITestCase


class ReleaseThresholdCreateTest(APITestCase):
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
            "sentry-api-0-project-releases-thresholds",
            kwargs={"organization_slug": self.organization.slug, "project_slug": self.project.slug},
        )

    def test_missing_params(self):
        response = self.client.post(
            self.url,
            data={
                "threshold_type": "total_error_count",
                "trigger_type": "absolute_over",
                # value is missing
                "window_in_seconds": 1800,
                "environment": "canary",
            },
        )

        assert response.status_code == 400
        assert response.data == {"value": ["This field is required."]}

    def test_invalid_threshold_type(self):
        response = self.client.post(
            self.url,
            data={
                "threshold_type": "indiana_jones_and_the_temple_of_doom",
                "trigger_type": "absolute_over",
                "value": 100,
                "window_in_seconds": 1800,
                "environment": "canary",
            },
        )

        assert response.status_code == 400
        assert response.data["threshold_type"][0].code == "invalid_choice"

    def test_invalid_trigger_type(self):
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

    def test_invalid_project(self):
        url_with_invalid_project = reverse(
            "sentry-api-0-project-releases-thresholds",
            kwargs={
                "organization_slug": self.organization.slug,
                "project_slug": "Why did it have to be snakes?",
            },
        )
        response = self.client.post(
            url_with_invalid_project,
            data={
                "threshold_type": "total_error_count",
                "trigger_type": "absolute_over",
                "value": 100,
                "window_in_seconds": 1800,
                "environment": "production",
            },
        )
        assert response.status_code == 404

    def test_invalid_environment(self):
        response = self.client.post(
            self.url,
            data={
                "threshold_type": "total_error_count",
                "trigger_type": "absolute_over",
                "value": 100,
                "window_in_seconds": 1800,
                "environment": "Sentry belongs in a museum.",
            },
        )
        assert response.status_code == 400
        assert response.data["environment"][0].code == "invalid"

    def test_valid_no_environment(self):
        response = self.client.post(
            self.url,
            data={
                "threshold_type": "total_error_count",
                "trigger_type": "absolute_over",
                "value": 100,
                "window_in_seconds": 1800,
            },
        )
        assert response.status_code == 201
        data = response.data
        assert data["threshold_type"] == "total_error_count"
        assert data["trigger_type"] == "absolute_over"
        assert data["value"] == 100
        assert data["window_in_seconds"] == 1800
        assert data["project"]["id"] == str(self.project.id)
        assert data["project"]["slug"] == self.project.slug
        assert data["project"]["name"] == self.project.name
        assert data["environment"] is None
        assert data["date_added"] is not None

    def test_valid(self):
        response = self.client.post(
            self.url,
            data={
                "threshold_type": "total_error_count",
                "trigger_type": "absolute_over",
                "value": 100,
                "window_in_seconds": 1800,
                "environment": "canary",
            },
        )

        assert response.status_code == 201
        # {'threshold_type': 'total_error_count', 'trigger_type': 'absolute_over', 'value': 100, 'window_in_seconds': 1800, 'project': {'id': '4552578081357825', 'slug': 'bar', 'name': 'Bar', 'platform': None, 'dateCreated': datetime.datetime(2023, 9, 5, 21, 44, 58, 78647, tzinfo=<UTC>), 'isBookmarked': False, 'isMember': False, 'features': ['alert-filters', 'data-forwarding', 'minidump', 'race-free-group-creation', 'rate-limits'], 'firstEvent': None, 'firstTransactionEvent': False, 'access': set(), 'hasAccess': True, 'hasMinifiedStackTrace': False, 'hasMonitors': False, 'hasProfiles': False, 'hasReplays': False, 'hasSessions': False, 'isInternal': False, 'isPublic': False, 'avatar': {'avatarType': 'letter_avatar', 'avatarUuid': None}, 'color': '#87bf3f', 'status': 'active'}, 'environment': {'id': '1', 'name': 'canary'}, 'date_added': datetime.datetime(2023, 9, 5, 21, 44, 58, 749322, tzinfo=<UTC>)}
        data = response.data
        assert data["threshold_type"] == "total_error_count"
        assert data["trigger_type"] == "absolute_over"
        assert data["value"] == 100
        assert data["window_in_seconds"] == 1800
        assert data["project"]["id"] == str(self.project.id)
        assert data["project"]["slug"] == self.project.slug
        assert data["project"]["name"] == self.project.name
        assert data["environment"]["id"] == str(self.canary_environment.id)
        assert data["environment"]["name"] == self.canary_environment.name
        assert data["date_added"] is not None
