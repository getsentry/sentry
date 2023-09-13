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

    def test_get_feedback_list(self):
        # Successful GET
        Feedback.objects.create(
            data={
                "environment": "production",
                "feedback": {
                    "contact_email": "colton.allen@sentry.io",
                    "message": "I really like this user-feedback feature!",
                    "replay_id": "ec3b4dc8b79f417596f7a1aa4fcca5d2",
                    "url": "https://docs.sentry.io/platforms/javascript/",
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
            project_id=self.project.id,
            organization_id=self.organization.id,
        )

        Feedback.objects.create(
            data={
                "environment": "prod",
                "feedback": {
                    "contact_email": "michelle.zhang@sentry.io",
                    "message": "I also really like this user-feedback feature!",
                    "replay_id": "zc3b5xy8b79f417596f7a1tt4fffa5d2",
                    "url": "https://docs.sentry.io/platforms/electron/",
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
            project_id=self.project.id,
            organization_id=self.organization.id,
        )

        with self.feature({"organizations:user-feedback-ingest": True}):
            path = reverse(self.endpoint, args=[self.organization.slug])
            response = self.client.get(path)
            assert response.status_code == 200

            # Should get what we have in the database
            assert len(response.data) == 2
            # Test first item
            feedback = response.data[0]
            assert feedback["dist"] == "abc123"
            assert feedback["url"] == "https://docs.sentry.io/platforms/javascript/"
            assert feedback["message"] == "I really like this user-feedback feature!"
            assert feedback["feedback_id"] == uuid.UUID("1ffe0775ac0f4417aed9de36d9f6f8dc")
            assert feedback["platform"] == "javascript"
            assert feedback["sdk"]["name"] == "sentry.javascript.react"
            assert feedback["tags"]["key"] == "value"
            assert feedback["contact_email"] == "colton.allen@sentry.io"

            # Test second item
            feedback = response.data[1]
            assert feedback["environment"] == "prod"
            assert feedback["url"] == "https://docs.sentry.io/platforms/electron/"
            assert feedback["message"] == "I also really like this user-feedback feature!"
            assert feedback["feedback_id"] == uuid.UUID("2ffe0775ac0f4417aed9de36d9f6f8ab")
            assert feedback["platform"] == "electron"
            assert feedback["sdk"]["name"] == "sentry.javascript.react"
            assert feedback["sdk"]["version"] == "5.18.1"

            # Testing GET parameters
            # For now, only testing per_page; others (such as sort, query) are not well-defined or not necessary for MVP
            response = self.client.get(
                path=path,
                data={"per_page": 1},
                content_type="application/json",
            )
            assert response.status_code == 200
            assert len(response.data) == 1

    def test_no_feature_enabled(self):
        # Unsuccessful GET
        with self.feature({"organizations:user-feedback-ingest": False}):
            path = reverse(self.endpoint, args=[self.organization.slug])
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
