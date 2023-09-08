from django.urls import reverse

from sentry.feedback.models import Feedback
from sentry.testutils.cases import MonitorIngestTestCase

test_data = {
    "contexts": {},
    "tags": {
        "sentry_version": "23.9.0.dev0",
    },
    "timestamp": 1694039635.9195,
    "message": "This website is great!",
    "transaction": "/replays/",
    "type": "transaction",
    "transaction_info": {"source": "route"},
    "platform": "javascript",
    "event_id": "b51647a3c56f4a939984bb1147a6c3e5",
    "environment": "prod",
    "release": "frontend@40f88cd929122ac73749cc48f0ddb9aa223449ff",
    "sdk": {"name": "sentry.javascript.react", "version": "7.66.0-alpha.0"},
    "user": {
        "ip_address": "72.164.175.154",
        "email": "josh.ferge@sentry.io",
        "id": 880461,
        "isStaff": False,
        "name": "Josh Ferge",
    },
    "request": {
        "url": "https://sentry.sentry.io/replays/?project=11276&statsPeriod=7d",
        "headers": {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36"
        },
    },
}

wrong_test_data = {
    "contexts33": {},
    "tags!": {
        "sentry_version": "23.9.0.dev0",
    },
    "platform_bad": "javascript",
    "event_id": "b51647a3c56f4a939984bb1147a6c3e5",
}

missing_event_id_test_data = {
    "contexts": {},
    "tags": {
        "sentry_version": "23.9.0.dev0",
    },
    "timestamp": 1694039635.9195,
    "message": "This website is great!",
    "transaction": "/replays/",
    "type": "transaction",
    "transaction_info": {"source": "route"},
    "platform": "javascript",
    "environment": "prod",
    "release": "frontend@40f88cd929122ac73749cc48f0ddb9aa223449ff",
    "sdk": {"name": "sentry.javascript.react", "version": "7.66.0-alpha.0"},
    "user": {
        "ip_address": "72.164.175.154",
        "email": "josh.ferge@sentry.io",
        "id": 880461,
        "isStaff": False,
        "name": "Josh Ferge",
    },
    "request": {
        "url": "https://sentry.sentry.io/replays/?project=11276&statsPeriod=7d",
        "headers": {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36"
        },
    },
}

wrong_type_test_data = {
    "timestamp": "1694039635.9195",
    "message": 24,
    "event_id": "b51647a3c56f4a939984bb1147a6c3e5",
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
            assert feedback.data["type"] == "transaction"
            assert feedback.data["environment"] == "prod"
            assert feedback.data["sdk"]["name"] == "sentry.javascript.react"
            assert feedback.data["transaction_info"]["source"] == "route"
            assert feedback.data["tags"]["sentry_version"] == "23.9.0.dev0"
            assert feedback.data["release"] == "frontend@40f88cd929122ac73749cc48f0ddb9aa223449ff"
            assert feedback.data["user"]["name"] == "Josh Ferge"
            assert (
                feedback.data["request"]["url"]
                == "https://sentry.sentry.io/replays/?project=11276&statsPeriod=7d"
            )
            assert feedback.data["platform"] == "javascript"
            assert feedback.message == "This website is great!"

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
        with self.feature({"organizations:user-feedback-ingest": True}):
            path = reverse(self.endpoint)
            response = self.client.post(path, data=wrong_test_data, **self.dsn_auth_headers)
            assert response.status_code == 500

    def test_no_event_id(self):
        # Event ID is required for a successful post
        with self.feature({"organizations:user-feedback-ingest": True}):
            path = reverse(self.endpoint)
            response = self.client.post(
                path, data=missing_event_id_test_data, **self.dsn_auth_headers
            )
            assert response.status_code == 400

    def test_wrong_type(self):
        # Fields should be correct type
        with self.feature({"organizations:user-feedback-ingest": True}):
            path = reverse(self.endpoint)
            response = self.client.post(path, data=wrong_type_test_data, **self.dsn_auth_headers)
            assert response.status_code == 500

    def test_bad_slug_path(self):
        # Bad slug in path should lead to unsuccessful save
        with self.feature({"organizations:user-feedback-ingest": True}):
            path = reverse(self.endpoint)
            response = self.client.post(path + "bad_slug", data=test_data, **self.dsn_auth_headers)
            assert response.status_code == 404
