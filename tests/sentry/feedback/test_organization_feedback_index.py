import datetime
import uuid

from django.urls import reverse
from rest_framework.exceptions import ErrorDetail

from sentry.feedback.models import Feedback
from sentry.testutils.cases import APITestCase


class OrganizationFeedbackIndexTest(APITestCase):
    endpoint = "sentry-api-0-organization-feedback-index"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.org = self.create_organization()
        self.team = self.create_team(organization=self.org)
        self.create_member(teams=[self.team], user=self.user, organization=self.org)

        self.project_1 = self.create_project(
            organization=self.org, teams=[self.team], name="replayteam"
        )
        self.project_2 = self.create_project(
            organization=self.org, teams=[self.team], name="feedbackteam"
        )

        self.environment_1 = self.create_environment(project=self.project_1, name="prod")
        self.environment_2 = self.create_environment(project=self.project_2, name="dev")

    def mock_feedback(self):
        Feedback.objects.create(
            data={
                "feedback": {
                    "contact_email": "colton.allen@sentry.io",
                    "message": "I really like this user-feedback feature!",
                    "replay_id": "ec3b4dc8b79f417596f7a1aa4fcca5d2",
                    "url": "https://docs.sentry.io/platforms/javascript/",
                    "name": "Colton Allen",
                },
                "platform": "javascript",
                "release": "version@1.3",
                "sdk": {"name": "sentry.javascript.react", "version": "6.18.1"},
                "tags": {"key": "value"},
                "user": {
                    "email": "username@example.com",
                    "id": "123",
                    "ip_address": "127.0.0.1",
                    "name": "user",
                    "username": "user2270129",
                },
                "dist": "abc123",
                "contexts": {},
            },
            date_added=datetime.datetime.fromtimestamp(1234456),
            feedback_id=uuid.UUID("1ffe0775ac0f4417aed9de36d9f6f8dc"),
            url="https://docs.sentry.io/platforms/javascript/",
            message="I really like this user-feedback feature!",
            replay_id=uuid.UUID("ec3b4dc8b79f417596f7a1aa4fcca5d2"),
            project_id=self.project_1.id,
            organization_id=self.org.id,
            environment=self.environment_1,
        )

        Feedback.objects.create(
            data={
                "feedback": {
                    "contact_email": "michelle.zhang@sentry.io",
                    "message": "I also really like this user-feedback feature!",
                    "replay_id": "zc3b5xy8b79f417596f7a1tt4fffa5d2",
                    "url": "https://docs.sentry.io/platforms/electron/",
                    "name": "Michelle Zhang",
                },
                "platform": "electron",
                "release": "version@1.3",
                "request": {
                    "headers": {
                        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.0.0 Safari/537.36"
                    }
                },
                "sdk": {"name": "sentry.javascript.react", "version": "5.18.1"},
                "tags": {"key": "value"},
                "user": {
                    "email": "username@example.com",
                    "id": "123",
                    "ip_address": "127.0.0.1",
                    "name": "user",
                    "username": "user2270129",
                },
                "dist": "abc123",
                "contexts": {},
            },
            date_added=datetime.datetime.fromtimestamp(12344100333),
            feedback_id=uuid.UUID("2ffe0775ac0f4417aed9de36d9f6f8ab"),
            url="https://docs.sentry.io/platforms/electron/",
            message="I also really like this user-feedback feature!",
            replay_id=uuid.UUID("ec3b4dc8b79f417596f7a1aa4fcca5d2"),
            project_id=self.project_2.id,
            organization_id=self.org.id,
            environment=self.environment_2,
        )

    def test_get_feedback_list(self):
        # Successful GET without filters
        with self.feature({"organizations:user-feedback-ingest": True}):
            self.mock_feedback()
            path = reverse(self.endpoint, args=[self.org.slug])
            response = self.client.get(path)
            assert response.status_code == 200

            # We should get a count of everything in the database
            assert response.headers["X-Hits"] == "2"

            # Should get what we have in the database
            assert len(response.data) == 2
            # Test sorting by `date_added`
            # First item
            feedback = response.data[0]
            assert feedback["environment"] == "dev"
            assert feedback["url"] == "https://docs.sentry.io/platforms/electron/"
            assert feedback["message"] == "I also really like this user-feedback feature!"
            assert feedback["feedback_id"] == str(
                uuid.UUID("2ffe0775ac0f4417aed9de36d9f6f8ab")
            ).replace("-", "")
            assert feedback["platform"] == "electron"
            assert feedback["sdk"]["name"] == "sentry.javascript.react"
            assert feedback["sdk"]["version"] == "5.18.1"

            # Second item
            feedback = response.data[1]
            assert feedback["dist"] == "abc123"
            assert feedback["url"] == "https://docs.sentry.io/platforms/javascript/"
            assert feedback["message"] == "I really like this user-feedback feature!"
            assert feedback["feedback_id"] == str(
                uuid.UUID("1ffe0775ac0f4417aed9de36d9f6f8dc")
            ).replace("-", "")
            assert feedback["platform"] == "javascript"
            assert feedback["sdk"]["name"] == "sentry.javascript.react"
            assert feedback["tags"]["key"] == "value"
            assert feedback["contact_email"] == "colton.allen@sentry.io"
            assert feedback["name"] == "Colton Allen"

            # Test `per_page`
            response = self.client.get(
                path=path,
                data={"per_page": 1},
                content_type="application/json",
            )
            assert response.status_code == 200
            assert response.headers["X-Hits"] == "2"
            assert len(response.data) == 1

    def test_no_feature_enabled(self):
        # Unsuccessful GET
        with self.feature({"organizations:user-feedback-ingest": False}):
            path = reverse(self.endpoint, args=[self.org.slug])
            get_response = self.client.get(path)
            assert get_response.status_code == 404

    def test_bad_slug_path(self):
        # Bad slug in path should lead to unsuccessful GET
        with self.feature({"organizations:user-feedback-ingest": True}):
            path = reverse(self.endpoint, args=["testslug123345"])
            get_response = self.client.get(path)
            assert get_response.status_code == 404
            assert get_response.data == {
                "detail": ErrorDetail(string="The requested resource does not exist", code="error")
            }

    def test_proj_filter(self):
        with self.feature({"organizations:user-feedback-ingest": True}):
            self.mock_feedback()
            path = reverse(self.endpoint, args=[self.org.slug])
            response = self.client.get(path, {"project": self.project_2.id})
            assert response.status_code == 200

            # Should get item that matches the project
            assert len(response.data) == 1
            feedback = response.data[0]
            assert feedback["feedback_id"] == str(
                uuid.UUID("2ffe0775ac0f4417aed9de36d9f6f8ab")
            ).replace("-", "")

    def test_stats_period_filter(self):
        with self.feature({"organizations:user-feedback-ingest": True}):
            self.mock_feedback()
            path = reverse(self.endpoint, args=[self.org.slug])
            response = self.client.get(
                path,
                {
                    "start": (datetime.datetime.fromtimestamp(12344100333)).isoformat() + "Z",
                    "end": (
                        (datetime.datetime.fromtimestamp(12344100333)) + datetime.timedelta(days=1)
                    ).isoformat()
                    + "Z",
                },
            )
            assert response.status_code == 200

            # Should get item that matches the time period
            assert len(response.data) == 1
            feedback = response.data[0]
            assert feedback["feedback_id"] == str(
                uuid.UUID("2ffe0775ac0f4417aed9de36d9f6f8ab")
            ).replace("-", "")

    def test_env_filter(self):
        with self.feature({"organizations:user-feedback-ingest": True}):
            self.mock_feedback()
            path = reverse(self.endpoint, args=[self.org.slug])
            response = self.client.get(
                path,
                {
                    "environment": self.environment_1.name,
                },
            )
            assert response.status_code == 200

            # Should get item that matches the environment
            assert len(response.data) == 1
            feedback = response.data[0]
            assert feedback["feedback_id"] == str(
                uuid.UUID("1ffe0775ac0f4417aed9de36d9f6f8dc")
            ).replace("-", "")
            assert feedback["environment"] == self.environment_1.name

    def test_invalid_env_filter(self):
        with self.feature({"organizations:user-feedback-ingest": True}):
            self.mock_feedback()
            path = reverse(self.endpoint, args=[self.org.slug])
            response = self.client.get(
                path,
                {
                    "environment": self.environment.name,
                },
            )
            assert response.status_code == 200

            # Should returns nothing
            assert len(response.data) == 0

    def test_no_items_found(self):
        with self.feature({"organizations:user-feedback-ingest": True}):
            self.mock_feedback()
            path = reverse(self.endpoint, args=[self.org.slug])
            response = self.client.get(
                path,
                {
                    "start": (datetime.datetime.fromtimestamp(12344100333)).isoformat() + "Z",
                    "end": (
                        (datetime.datetime.fromtimestamp(12344100333)) + datetime.timedelta(days=1)
                    ).isoformat()
                    + "Z",
                    "project": self.project_1.id,
                    "environment": self.environment_1.name,
                },
            )
            assert response.status_code == 200

            # Should return nothing
            assert len(response.data) == 0
