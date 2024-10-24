from datetime import datetime

import pytest
from django.urls import reverse

from sentry.issues.grouptype import ReplayRageClickType
from sentry.testutils.cases import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now
from tests.sentry.issues.test_utils import OccurrenceTestMixin

pytestmark = pytest.mark.sentry_metrics


class OrganizationEventsMetaTest(APITestCase, SnubaTestCase, OccurrenceTestMixin):
    def setUp(self):
        super().setUp()
        self.min_ago = before_now(minutes=1).replace(microsecond=0)
        self.login_as(user=self.user)
        self.project_1 = self.create_project()
        self.project_2 = self.create_project()
        self.url = reverse(
            "sentry-api-0-organization-replay-events-meta",
            kwargs={"organization_id_or_slug": self.project.organization.slug},
        )
        self.features = {"organizations:session-replay": True}

    def test_simple(self):
        event_id_a = "a" * 32
        event_id_b = "b" * 32

        event_a = self.store_event(
            data={"event_id": event_id_a, "timestamp": self.min_ago.isoformat()},
            project_id=self.project_1.id,
        )
        event_b = self.store_event(
            data={"event_id": event_id_b, "timestamp": self.min_ago.isoformat()},
            project_id=self.project_2.id,
        )
        self.store_event(data={"timestamp": self.min_ago.isoformat()}, project_id=self.project_1.id)
        self.store_event(data={"timestamp": self.min_ago.isoformat()}, project_id=self.project_1.id)

        query = {"query": f"id:[{event_id_a}, {event_id_b}]"}
        with self.feature(self.features):
            response = self.client.get(self.url, query, format="json")

        expected = [
            {
                "error.type": [],
                "error.value": [],
                "id": event_id_a,
                "issue.id": event_a.group.id,
                "issue": event_a.group.qualified_short_id,
                "project.name": self.project_1.slug,
                "timestamp": self.min_ago.isoformat(),
                "title": "<unlabeled event>",
            },
            {
                "error.type": [],
                "error.value": [],
                "id": event_id_b,
                "issue.id": event_b.group.id,
                "issue": event_b.group.qualified_short_id,
                "project.name": self.project_2.slug,
                "timestamp": self.min_ago.isoformat(),
                "title": "<unlabeled event>",
            },
        ]

        assert response.status_code == 200, response.content
        assert sorted(response.data["data"], key=lambda v: v["id"]) == expected

    def test_rage_clicks(self):
        event_id_a = "a" * 32

        _, group_info = self.process_occurrence(
            **{
                "project_id": self.project.id,
                "event_id": event_id_a,
                "fingerprint": ["c" * 32],
                "issue_title": "Rage Click",
                "type": ReplayRageClickType.type_id,
                "detection_time": datetime.now().timestamp(),
                "level": "info",
            },
            event_data={
                "platform": "javascript",
                "timestamp": self.min_ago.isoformat(),
                "received": self.min_ago.isoformat(),
            },
        )

        query = {"query": f"id:[{event_id_a}]", "dataset": "issuePlatform"}
        with self.feature(self.features):
            response = self.client.get(self.url, query, format="json")

        assert group_info is not None
        expected = [
            {
                "error.type": "",
                "error.value": "",
                "id": event_id_a,
                "issue.id": group_info.group.id,
                "issue": group_info.group.qualified_short_id,
                "project.name": self.project.slug,
                "timestamp": self.min_ago.isoformat(),
                "title": "Rage Click",
            }
        ]

        assert response.status_code == 200, response.content
        assert sorted(response.data["data"], key=lambda v: v["id"]) == expected
