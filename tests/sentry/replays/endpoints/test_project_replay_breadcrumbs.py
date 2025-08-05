import uuid
from datetime import datetime

from django.urls import reverse

from sentry.replays.lib.eap.write import insert_trace_items, new_trace_item
from sentry.testutils.cases import APITestCase, SnubaTestCase


class OrganizationTraceItemsAttributesRankedEndpointTest(APITestCase, SnubaTestCase):
    endpoint = "sentry-api-0-project-replay-details-breadcrumbs"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.replay_id = uuid.uuid4().hex
        self.url = reverse(
            self.endpoint, args=(self.organization.slug, self.project.slug, self.replay_id)
        )

    def test(self):
        insert_trace_items(
            [
                new_trace_item(
                    {
                        "attributes": {"abc": "hello", "def": 2.2, "replay_id": self.replay_id},
                        "client_sample_rate": 1.0,
                        "organization_id": self.project.organization.id,
                        "project_id": self.project.id,
                        "received": datetime.now(),
                        "retention_days": 90,
                        "server_sample_rate": 1.0,
                        "timestamp": datetime.now(),
                        "trace_id": uuid.uuid4().hex,
                        "trace_item_id": uuid.uuid4().bytes,
                        "trace_item_type": "replay",
                    }
                )
            ]
        )

        response = self.client.get(self.url)
        raise Exception(response.content)
