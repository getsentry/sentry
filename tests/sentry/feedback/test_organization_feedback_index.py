import uuid

from django.urls import reverse
from rest_framework.exceptions import ErrorDetail

from sentry.testutils.cases import MonitorIngestTestCase

post_data_1 = {
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

post_data_2 = {
    "environment": "prod",
    "event_id": "2ffe0775ac0f4417aed9de36d9f6f8ab",
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
    "timestamp": 12344100333,
}


class OrganizationFeedbackIndexTest(MonitorIngestTestCase):
    get_endpoint = "sentry-api-0-organization-feedback-index"
    post_endpoint = "sentry-api-0-feedback-ingest"

    def test_get_feedback_list(self):
        # Successful GET
        with self.feature({"organizations:user-feedback-ingest": True}):
            get_path = reverse(self.get_endpoint, args=[self.organization.slug])
            post_path = reverse(self.post_endpoint)
            self.client.post(
                post_path,
                data=post_data_1,
                **self.dsn_auth_headers,
            )
            self.client.post(
                post_path,
                data=post_data_2,
                **self.dsn_auth_headers,
            )
            get_response = self.client.get(get_path, **self.dsn_auth_headers)
            assert get_response.status_code == 200

            # Should get what we just posted
            assert len(get_response.data) == 2
            # Test first item
            feedback = get_response.data[0]
            assert feedback["dist"] == "abc123"
            assert feedback["url"] == "https://docs.sentry.io/platforms/javascript/"
            assert feedback["message"] == "I really like this user-feedback feature!"
            assert feedback["id"] == uuid.UUID("1ffe0775ac0f4417aed9de36d9f6f8dc")
            assert feedback["platform"] == "javascript"
            assert feedback["sdk"]["name"] == "sentry.javascript.react"
            assert feedback["tags"]["key"] == "value"
            assert feedback["contact_email"] == "colton.allen@sentry.io"

            # Test second item
            feedback = get_response.data[1]
            assert feedback["environment"] == "prod"
            assert feedback["url"] == "https://docs.sentry.io/platforms/electron/"
            assert feedback["message"] == "I also really like this user-feedback feature!"
            assert feedback["id"] == uuid.UUID("2ffe0775ac0f4417aed9de36d9f6f8ab")
            assert feedback["platform"] == "electron"
            assert feedback["sdk"]["name"] == "sentry.javascript.react"
            assert feedback["sdk"]["version"] == "5.18.1"

    def test_no_feature_enabled(self):
        # Unsuccessful GET
        with self.feature({"organizations:user-feedback-ingest": False}):
            get_path = reverse(self.get_endpoint, args=[self.organization.slug])
            post_path = reverse(self.post_endpoint)
            self.client.post(
                post_path,
                data=post_data_1,
                **self.dsn_auth_headers,
            )
            get_response = self.client.get(get_path, **self.dsn_auth_headers)
            assert get_response.status_code == 404

    def test_no_authorization(self):
        # No authorization should lead to unsuccessful GET
        with self.feature({"organizations:user-feedback-ingest": False}):
            get_path = reverse(self.get_endpoint, args=[self.organization.slug])
            post_path = reverse(self.post_endpoint)
            self.client.post(
                post_path,
                data=post_data_1,
                **self.dsn_auth_headers,
            )
            get_response = self.client.get(get_path)
            assert get_response.status_code == 401
            assert get_response.data == {"detail": "Authentication credentials were not provided."}

    def test_bad_slug_path(self):
        # Bad slug in path should lead to unsuccessful GET
        with self.feature({"organizations:user-feedback-ingest": True}):
            get_path = reverse(self.get_endpoint, args=["testslug123345"])
            post_path = reverse(self.post_endpoint)
            self.client.post(
                post_path,
                data=post_data_1,
                **self.dsn_auth_headers,
            )
            get_response = self.client.get(get_path, **self.dsn_auth_headers)
            assert get_response.status_code == 404
            assert get_response.data == {
                "detail": ErrorDetail(string="The requested resource does not exist", code="error")
            }

    def test_parameters(self):
        # Testing GET parameters
        # For now, only testing per_page; others (such as sort, query) are not well-defined or not necessary for MVP
        with self.feature({"organizations:user-feedback-ingest": True}):
            get_path = reverse(self.get_endpoint, args=[self.organization.slug])
            post_path = reverse(self.post_endpoint)
            self.client.post(
                post_path,
                data=post_data_1,
                **self.dsn_auth_headers,
            )
            self.client.post(
                post_path,
                data=post_data_2,
                **self.dsn_auth_headers,
            )
            get_response = self.client.get(
                path=get_path,
                data={"per_page": 1},
                content_type="application/json",
                **self.dsn_auth_headers,
            )
            assert get_response.status_code == 200
            assert len(get_response.data) == 1
