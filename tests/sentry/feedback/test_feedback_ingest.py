from unittest.mock import patch

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
        "name": "Colton Allen",
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
    "contexts": {
        "BrowserContext": {"name": "Chrome", "version": "116.0.0"},
        "DeviceContext": {"family": "Mac", "model": "Mac", "brand": "Apple", "type": "device"},
    },
}


class FeedbackIngestTest(MonitorIngestTestCase):
    endpoint = "sentry-api-0-feedback-ingest"

    @patch("sentry.feedback.usecases.create_feedback.produce_occurrence_to_kafka")
    def test_save_feedback(self, mock_produce_occurrence_to_kafka):
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
            assert feedback.environment.name == "production"
            assert feedback.data["sdk"]["name"] == "sentry.javascript.react"
            assert feedback.data["feedback"]["contact_email"] == "colton.allen@sentry.io"
            assert (
                feedback.data["feedback"]["message"] == "I really like this user-feedback feature!"
            )
            assert feedback.data["feedback"]["name"] == "Colton Allen"
            assert feedback.data["tags"]["key"] == "value"
            assert feedback.data["release"] == "version@1.3"
            assert feedback.data["user"]["name"] == "user"
            assert (
                feedback.data["request"]["headers"]["User-Agent"]
                == "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.0.0 Safari/537.36"
            )
            assert feedback.data["platform"] == "javascript"

            assert len(mock_produce_occurrence_to_kafka.mock_calls) == 1
            mock_event_data = mock_produce_occurrence_to_kafka.call_args_list[0][1]["event_data"]
            assert (
                mock_event_data["contexts"]["feedback"]["contact_email"] == "colton.allen@sentry.io"
            )
            assert (
                mock_event_data["contexts"]["feedback"]["message"]
                == "I really like this user-feedback feature!"
            )
            assert mock_event_data["contexts"]["feedback"]["name"] == "Colton Allen"
            assert mock_event_data["platform"] == "javascript"
            assert "associated_event_id" not in mock_event_data["contexts"]["feedback"]
            assert mock_event_data["level"] == "info"

            self.project.refresh_from_db()
            assert self.project.flags.has_feedbacks
            assert self.project.flags.has_new_feedbacks

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

    def test_no_timestamp(self):
        # Timestamp field is required for a successful post
        missing_timestamp_test_data = {
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
        }

        with self.feature({"organizations:user-feedback-ingest": True}):
            path = reverse(self.endpoint)
            response = self.client.post(
                path, data=missing_timestamp_test_data, **self.dsn_auth_headers
            )
            assert response.status_code == 400
            assert response.data == {
                "timestamp": [ErrorDetail(string="This field is required.", code="required")]
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
            "platform": "javascript",
            "release": "1",
            "sdk": {"name": "sentry.javascript.react", "version": "6.18.1"},
            "timestamp": {},
        }

        with self.feature({"organizations:user-feedback-ingest": True}):
            path = reverse(self.endpoint)
            response = self.client.post(path, data=wrong_type_test_data, **self.dsn_auth_headers)
            assert response.status_code == 400
            assert response.data == {
                "timestamp": [ErrorDetail(string="A valid number is required.", code="invalid")]
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
            "feedback": {
                "message": "I really like this user-feedback feature!",
                "url": "https://docs.sentry.io/platforms/javascript/",
            },
            "platform": "javascript",
            "sdk": {"name": "sentry.javascript.react", "version": "6.18.1"},
            "timestamp": 1234456,
        }

        with self.feature({"organizations:user-feedback-ingest": True}):
            path = reverse(self.endpoint)
            response = self.client.post(
                path,
                data=test_data_missing_optional_fields,
                **self.dsn_auth_headers,
            )
            assert response.status_code == 201, response.content

    def test_env(self):
        # No environment name in input should default the field to "production"
        test_data_missing_optional_fields = {
            "feedback": {
                "contact_email": "colton.allen@sentry.io",
                "message": "I really like this user-feedback feature!",
                "url": "https://docs.sentry.io/platforms/javascript/",
            },
            "platform": "javascript",
            "sdk": {"name": "sentry.javascript.react", "version": "6.18.1"},
            "timestamp": 1234456,
        }

        with self.feature({"organizations:user-feedback-ingest": True}):
            path = reverse(self.endpoint)
            response = self.client.post(
                path,
                data=test_data_missing_optional_fields,
                **self.dsn_auth_headers,
            )
            assert response.status_code == 201, response.content
            feedback_list = Feedback.objects.all()
            feedback = feedback_list[0]
            assert feedback.environment.name == "production"
