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


class FeedbackIngestTest(MonitorIngestTestCase):
    endpoint = "sentry-api-0-feedback-ingest"

    def test_save_with_feedback(self):
        # Feature enabled, successful save
        with self.feature({"organizations:user-feedback-ingest": True}):
            path = reverse(self.endpoint)
            response = self.client.post(path, data=test_data, **self.dsn_auth_headers)
            assert response.status_code == 201, response.content
            feedback_list = Feedback.objects.all()
            assert len(feedback_list) == 1
            assert feedback_list[0].data["type"] == "transaction"

        # Feature disabled
        with self.feature({"organizations:user-feedback-ingest": False}):
            path = reverse(self.endpoint)
            response = self.client.post(path, data=test_data, **self.dsn_auth_headers)
            assert response.status_code == 404, response.content
