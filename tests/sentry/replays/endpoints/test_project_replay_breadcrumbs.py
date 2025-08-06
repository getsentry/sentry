import uuid
from datetime import datetime, timedelta

from django.urls import reverse

from sentry.replays.lib.eap.write import new_trace_item, write_trace_items_test_suite
from sentry.testutils.cases import APITestCase, SnubaTestCase

REPLAYS_FEATURES = {"organizations:session-replay": True}


class OrganizationTraceItemsAttributesRankedEndpointTest(APITestCase, SnubaTestCase):
    endpoint = "sentry-api-0-project-replay-details-breadcrumbs"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.replay_id = uuid.uuid4().hex
        self.url = reverse(
            self.endpoint, args=(self.organization.slug, self.project.slug, self.replay_id)
        )

    def test_get_mutations_breadcrumb(self):
        write_trace_items_test_suite(
            [
                new_trace_item(
                    {
                        "attributes": {
                            "category": "replay.mutations",
                            "replay_id": self.replay_id,
                            "count": 22,
                        },
                        "client_sample_rate": 1.0,
                        "organization_id": self.project.organization.id,
                        "project_id": self.project.id,
                        "received": datetime.now(),
                        "retention_days": 90,
                        "server_sample_rate": 1.0,
                        "timestamp": datetime.now() - timedelta(minutes=1),
                        "trace_id": uuid.uuid4().hex,
                        "trace_item_id": uuid.uuid4().bytes,
                        "trace_item_type": "replay",
                    }
                )
            ]
        )

        with self.feature(REPLAYS_FEATURES):
            response = self.client.get(self.url + "?statsPeriod=1d")
            assert response.status_code == 200

            response_json = response.json()
            assert len(response_json["data"]) == 1
            assert response_json["data"][0]["type"] == "replay.mutations"
            assert response_json["data"][0]["attributes"]["count"] == 22
