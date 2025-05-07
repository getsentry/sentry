from datetime import datetime, timedelta
from unittest.mock import patch

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

        min_ago_ms = self.min_ago + timedelta(milliseconds=123)
        event_a = self.store_event(
            data={
                "event_id": event_id_a,
                "timestamp": min_ago_ms.isoformat(),
            },
            project_id=self.project_1.id,
        )
        event_b = self.store_event(
            data={
                "event_id": event_id_b,
                "timestamp": min_ago_ms.isoformat(),
            },
            project_id=self.project_2.id,
        )
        self.store_event(
            data={
                "timestamp": min_ago_ms.isoformat(),
            },
            project_id=self.project_1.id,
        )
        self.store_event(
            data={
                "timestamp": min_ago_ms.isoformat(),
            },
            project_id=self.project_1.id,
        )

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
                "timestamp": min_ago_ms.isoformat(),
                "title": "<unlabeled event>",
            },
            {
                "error.type": [],
                "error.value": [],
                "id": event_id_b,
                "issue.id": event_b.group.id,
                "issue": event_b.group.qualified_short_id,
                "project.name": self.project_2.slug,
                "timestamp": min_ago_ms.isoformat(),
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

    def test_timestamp_ms_none(self):
        """
        Test handling of null timestamp_ms values in events.

        timestamp_ms is a new property added to events, but old events in the database
        don't have this field populated (it is null). Over time this will no longer be
        an issue as new events always include timestamp_ms, but for now we need to handle
        the case where timestamp_ms is null. This test mocks a Snuba response to verify
        we handle null timestamp_ms values correctly, simply keeping the timestamp as is.
        """

        # Craft the fake Snuba response
        fake_snuba_data = {
            "data": [
                {
                    "id": "abc123",
                    "timestamp": self.min_ago.isoformat(),
                    "timestamp_ms": None,
                }
            ]
        }

        # Patch the discover.query function used by the endpoint
        with patch("sentry.snuba.discover.query", return_value=fake_snuba_data):
            query = {"query": "id:[abc123]"}
            with self.feature(self.features):
                response = self.client.get(self.url, query, format="json")

        # Now assert on the response as usual
        assert response.status_code == 200
        assert "timestamp_ms" not in response.data["data"][0]
        assert response.data["data"][0]["timestamp"] == self.min_ago.isoformat()
