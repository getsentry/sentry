import uuid
from datetime import datetime

from django.urls import reverse

from sentry.replays.lib.eap.write import test_suite_insert_trace_items
from sentry.testutils.cases import APITestCase, SnubaTestCase


class OrganizationTraceItemsAttributesRankedEndpointTest(APITestCase, SnubaTestCase):
    endpoint = "sentry-api-0-project-replay-details-breadcrumbs"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.url = reverse(self.endpoint, args=(self.organization.slug,))

    def test(self):
        test_suite_insert_trace_items(
            [
                {
                    "attributes": {"abc": "hello", "def": 2.2},
                    "client_sample_rate": 1.0,
                    "organization_id": self.organization.id,
                    "project_id": self.project.id,
                    "received": datetime.now(),
                    "retention_days": 90,
                    "server_sample_rate": 1.0,
                    "timestamp": datetime.now(),
                    "trace_id": "1",
                    "trace_item_id": uuid.uuid4().bytes,
                    "trace_item_type": "replay",
                }
            ]
        )

        self.client.get(self.url)
