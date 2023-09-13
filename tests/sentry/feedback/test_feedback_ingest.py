from django.urls import reverse
from rest_framework.exceptions import ErrorDetail

from sentry.feedback.models import Feedback
from sentry.testutils.cases import MonitorIngestTestCase

test_data = {
    "dist": "abc123",
    "environment": "production",
    "event_id": "1ffe0775ac0f4417aed9de36d9f6f8dc",
    "feedback": {
        "contact_email": "colton.allen@sentry.io",
        "message": "I really like this user-feedback feature!",
        "replay_id": "ec3b4dc8b79f417596f7a1aa4fcca5d2",
        "url": "https://docs.sentry.io/platforms/javascript/",
    },
    "platform": "javascript",
    "release": "version@1.3",
    "request": {
        "headers": {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.0.0 Safari/537.36"
        }
    },
    "sdk": {"name": "sentry.javascript.react", "version": "6.18.1"},
    "tags": {"key": "value"},
    "timestamp": 1234456,
    "user": {
        "email": "username@example.com",
        "id": "123",
        "ip_address": "127.0.0.1",
        "name": "user",
        "username": "user2270129",
    },
}


class FeedbackIngestTest(MonitorIngestTestCase):
    endpoint = "sentry-api-0-feedback-ingest"

    def test_save_feedback(self):
        # Feature enabled should lead to successful save
        with self.feature({"organizations:user-feedback-ingest": True}):
            path = reverse(self.endpoint)
            response = self.client.post(path, data=test_data, **self.dsn_auth_headers)
            assert response.status_code == 201

            # Feedback object exists
            feedback_list = Feedback.objects.all()
            assert len(feedback_list) == 1

            # Feedback object is what was posted
            feedback = feedback_list[0]
            assert feedback.data["dist"] == "abc123"
            assert feedback.data["environment"] == "production"
            assert feedback.data["sdk"]["name"] == "sentry.javascript.react"
            assert feedback.data["feedback"]["contact_email"] == "colton.allen@sentry.io"
            assert (
                feedback.data["feedback"]["message"] == "I really like this user-feedback feature!"
            )
            assert feedback.data["tags"]["key"] == "value"
            assert feedback.data["release"] == "version@1.3"
            assert feedback.data["user"]["name"] == "user"
            assert (
                feedback.data["request"]["headers"]["User-Agent"]
                == "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.0.0 Safari/537.36"
            )
            assert feedback.data["platform"] == "javascript"

    def test_no_feature_enabled(self):
        # Feature disabled should lead to unsuccessful save
        with self.feature({"organizations:user-feedback-ingest": False}):
            path = reverse(self.endpoint)
            response = self.client.post(path, data=test_data, **self.dsn_auth_headers)
            assert response.status_code == 404

    def test_not_authorized(self):
        # No authorization should lead to unsuccessful save
        with self.feature({"organizations:user-feedback-ingest": True}):
            path = reverse(self.endpoint)
            response = self.client.post(path, data=test_data)
            assert response.status_code == 401
            assert response.data == {"detail": "Authentication credentials were not provided."}

    def test_wrong_input(self):
        # Wrong inputs should lead to failed validation
        wrong_test_data = {
            "dist!": "abc",
            "environment": "production",
            "feedback": {
                "contact_email": "colton.allen@sentry.io",
                "message": "I really like this user-feedback feature!",
                "replay_id": "ec3b4dc8b79f417596f7a1aa4fcca5d2",
                "url123": "https://docs.sentry.io/platforms/javascript/",
            },
            "platform": "javascript",
            "release": "version@1.3",
            "sdk": {"name": "sentry.javascript.react", "version": "6.18.1"},
            "timestamp": 1234456,
        }

        with self.feature({"organizations:user-feedback-ingest": True}):
            path = reverse(self.endpoint)
            response = self.client.post(path, data=wrong_test_data, **self.dsn_auth_headers)
            assert response.status_code == 400
            assert response.data == {
                "non_field_errors": [
                    ErrorDetail(string="Input has wrong field name or type", code="invalid")
                ]
            }

    def test_no_environment(self):
        # Environment field is required for a successful post
        missing_environment_test_data = {
            "dist": "abc123",
            "feedback": {
                "contact_email": "colton.allen@sentry.io",
                "message": "I really like this user-feedback feature!",
                "replay_id": "ec3b4dc8b79f417596f7a1aa4fcca5d2",
                "url": "https://docs.sentry.io/platforms/javascript/",
            },
            "platform": "javascript",
            "release": "version@1.3",
            "request": {
                "headers": {
                    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.0.0 Safari/537.36"
                }
            },
            "sdk": {"name": "sentry.javascript.react", "version": "6.18.1"},
            "tags": {"key": "value"},
            "timestamp": 1234456,
        }

        with self.feature({"organizations:user-feedback-ingest": True}):
            path = reverse(self.endpoint)
            response = self.client.post(
                path, data=missing_environment_test_data, **self.dsn_auth_headers
            )
            assert response.status_code == 400
            assert response.data == {
                "environment": [ErrorDetail(string="This field is required.", code="required")]
            }

    def test_wrong_type(self):
        # Fields should be correct type
        wrong_type_test_data = {
            "feedback": {
                "contact_email": "colton.allen@sentry.io",
                "message": "I really like this user-feedback feature!",
                "replay_id": "ec3b4dc8b79f417596f7a1aa4fcca5d2",
                "url": "https://docs.sentry.io/platforms/javascript/",
            },
            "environment": {},
            "platform": "javascript",
            "release": "1",
            "sdk": {"name": "sentry.javascript.react", "version": "6.18.1"},
            "timestamp": 123456,
        }

        with self.feature({"organizations:user-feedback-ingest": True}):
            path = reverse(self.endpoint)
            response = self.client.post(path, data=wrong_type_test_data, **self.dsn_auth_headers)
            assert response.status_code == 400
            assert response.data == {
                "environment": [ErrorDetail(string="Not a valid string.", code="invalid")]
            }

    def test_bad_slug_path(self):
        # Bad slug in path should lead to unsuccessful save
        with self.feature({"organizations:user-feedback-ingest": True}):
            path = reverse(self.endpoint)
            response = self.client.post(path + "bad_slug", data=test_data, **self.dsn_auth_headers)
            assert response.status_code == 404

    def test_missing_optional_fields(self):
        # Optional fields missing should still result in successful save
        test_data_missing_optional_fields = {
            "environment": "production",
            "feedback": {
                "contact_email": "colton.allen@sentry.io",
                "message": "I really like this user-feedback feature!",
                "url": "https://docs.sentry.io/platforms/javascript/",
            },
            "platform": "javascript",
            "release": "version@1.3",
            "sdk": {"name": "sentry.javascript.react", "version": "6.18.1"},
            "timestamp": 1234456,
        }

        with self.feature({"organizations:user-feedback-ingest": True}):
            path = reverse(self.endpoint)
            response = self.client.post(
                path, data=test_data_missing_optional_fields, **self.dsn_auth_headers
            )
            assert response.status_code == 201
