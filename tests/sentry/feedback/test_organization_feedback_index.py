from django.urls import reverse

from sentry.testutils.cases import MonitorIngestTestCase


class OrganizationFeedbackIndexTest(MonitorIngestTestCase):
    endpoint = "sentry-api-0-organization-feedback"

    def test_save_with_feedback(self):
        data = {
            "contexts": {},
            "tags": {
                "sentry_version": "23.9.0.dev0",
            },
            "timestamp": 1694039635.9195,
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

        path = reverse(self.endpoint, args=[self.organization.slug])
        response = self.client.post(path, data=data, **self.dsn_auth_headers)
        assert response.status_code == 201, response.content
