from __future__ import annotations

from datetime import timedelta

import pytest
from django.urls import reverse

from sentry.api.endpoints.timeseries import INGESTION_DELAY_MESSAGE
from sentry.testutils.cases import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now, freeze_time
from sentry.utils.samples import load_data
from tests.sentry.issues.test_utils import SearchIssueTestMixin


class OrganizationEventsTimeseriesEndpointTest(APITestCase, SnubaTestCase, SearchIssueTestMixin):
    endpoint = "sentry-api-0-organization-events-timeseries"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.authed_user = self.user

        self.start = before_now(days=1).replace(hour=10, minute=0, second=0, microsecond=0)
        self.end = self.start + timedelta(hours=2)

        self.project = self.create_project()
        self.project2 = self.create_project()
        self.user = self.create_user()
        self.user2 = self.create_user()
        transaction = load_data(
            "transaction",
            start_timestamp=self.start + timedelta(minutes=1),
            timestamp=self.start + timedelta(minutes=3),
        )
        transaction.update(
            {
                "transaction": "very bad",
                "tags": {"sentry:user": self.user.email},
            }
        )
        self.store_event(
            data=transaction,
            project_id=self.project.id,
        )
        transaction = load_data(
            "transaction",
            start_timestamp=self.start + timedelta(hours=1, minutes=1),
            timestamp=self.start + timedelta(hours=1, minutes=3),
        )
        transaction.update(
            {
                "transaction": "oh my",
                "tags": {"sentry:user": self.user2.email},
            }
        )
        self.store_event(
            data=transaction,
            project_id=self.project2.id,
        )
        transaction = load_data(
            "transaction",
            start_timestamp=self.start + timedelta(hours=1, minutes=2),
            timestamp=self.start + timedelta(hours=1, minutes=4),
        )
        transaction.update(
            {
                "transaction": "very bad",
                "tags": {"sentry:user": self.user2.email},
            }
        )
        self.store_event(
            data=transaction,
            project_id=self.project2.id,
        )
        self.url = reverse(
            "sentry-api-0-organization-events-timeseries",
            kwargs={"organization_id_or_slug": self.project.organization.slug},
        )

    def do_request(self, data, url=None, features=None):
        if features is None:
            features = {"organizations:discover-basic": True}
        with self.feature(features):
            return self.client.get(self.url if url is None else url, data=data, format="json")

    def test_no_projects(self) -> None:
        org = self.create_organization(owner=self.user)
        self.login_as(user=self.user)

        url = reverse(self.endpoint, kwargs={"organization_id_or_slug": org.slug})
        response = self.do_request({}, url)

        assert response.status_code == 200, response.content
        data = response.data
        assert "timeSeries" in data
        assert len(data["timeSeries"]) == 0
        assert "meta" not in data

    @pytest.mark.querybuilder
    def test_simple(self) -> None:
        response = self.do_request(
            {
                "start": self.start,
                "end": self.end,
                "interval": "1h",
                "project": [self.project.id, self.project2.id],
            },
        )
        assert response.status_code == 200, response.content
        assert response.data["meta"] == {
            "dataset": "discover",
            "start": self.start.timestamp() * 1000,
            "end": self.end.timestamp() * 1000,
        }
        assert len(response.data["timeSeries"]) == 1
        timeseries = response.data["timeSeries"][0]
        assert len(timeseries["values"]) == 3
        assert timeseries["yAxis"] == "count()"
        assert timeseries["values"] == [
            {
                "incomplete": False,
                "timestamp": self.start.timestamp() * 1000,
                "value": 1,
            },
            {
                "incomplete": False,
                "timestamp": self.start.timestamp() * 1000 + 3_600_000 * 1,
                "value": 2,
            },
            {
                "incomplete": False,
                "timestamp": self.start.timestamp() * 1000 + 3_600_000 * 2,
                "value": 0,
            },
        ]
        assert timeseries["meta"] == {
            "valueType": "integer",
            "valueUnit": None,
            "interval": 3_600_000,
        }

    def test_simple_multiple_yaxis(self) -> None:
        response = self.do_request(
            data={
                "start": self.start,
                "end": self.end,
                "interval": "1h",
                "yAxis": ["count()", "count_unique(user)"],
                "project": [self.project.id, self.project2.id],
            },
        )

        assert response.status_code == 200, response.content
        assert response.data["meta"] == {
            "dataset": "discover",
            "start": self.start.timestamp() * 1000,
            "end": self.end.timestamp() * 1000,
        }
        assert len(response.data["timeSeries"]) == 2
        timeseries = response.data["timeSeries"][0]
        assert len(timeseries["values"]) == 3
        assert timeseries["yAxis"] == "count()"
        assert timeseries["values"] == [
            {
                "incomplete": False,
                "timestamp": self.start.timestamp() * 1000,
                "value": 1,
            },
            {
                "incomplete": False,
                "timestamp": self.start.timestamp() * 1000 + 3_600_000 * 1,
                "value": 2,
            },
            {
                "incomplete": False,
                "timestamp": self.start.timestamp() * 1000 + 3_600_000 * 2,
                "value": 0,
            },
        ]
        assert timeseries["meta"] == {
            "valueType": "integer",
            "valueUnit": None,
            "interval": 3_600_000,
        }

        timeseries = response.data["timeSeries"][1]
        assert len(timeseries["values"]) == 3
        assert timeseries["yAxis"] == "count_unique(user)"
        assert timeseries["values"] == [
            {
                "incomplete": False,
                "timestamp": self.start.timestamp() * 1000,
                "value": 1,
            },
            {
                "incomplete": False,
                "timestamp": self.start.timestamp() * 1000 + 3_600_000 * 1,
                "value": 1,
            },
            {
                "incomplete": False,
                "timestamp": self.start.timestamp() * 1000 + 3_600_000 * 2,
                "value": 0,
            },
        ]
        assert timeseries["meta"] == {
            "valueType": "integer",
            "valueUnit": None,
            "interval": 3_600_000,
        }

    def test_simple_top_events(self) -> None:
        response = self.do_request(
            data={
                "start": self.start,
                "end": self.end,
                "interval": "1h",
                "yAxis": ["count()", "p95()"],
                "groupBy": ["count()", "message"],
                "orderby": ["-count()"],
                "topEvents": 5,
                "project": [self.project.id, self.project2.id],
            },
        )

        assert response.status_code == 200, response.content
        assert response.data["meta"] == {
            "dataset": "discover",
            "start": self.start.timestamp() * 1000,
            "end": self.end.timestamp() * 1000,
        }
        assert len(response.data["timeSeries"]) == 4
        timeseries = response.data["timeSeries"][0]
        assert len(timeseries["values"]) == 3
        assert timeseries["yAxis"] == "count()"
        assert timeseries["groupBy"] == [{"key": "message", "value": "very bad"}]
        assert timeseries["meta"] == {
            "order": 0,
            "isOther": False,
            "valueType": "integer",
            "valueUnit": None,
            "interval": 3_600_000,
        }
        assert timeseries["values"] == [
            {
                "incomplete": False,
                "timestamp": self.start.timestamp() * 1000,
                "value": 1,
            },
            {
                "incomplete": False,
                "timestamp": self.start.timestamp() * 1000 + 3_600_000 * 1,
                "value": 1,
            },
            {
                "incomplete": False,
                "timestamp": self.start.timestamp() * 1000 + 3_600_000 * 2,
                "value": 0,
            },
        ]

        timeseries = response.data["timeSeries"][1]
        assert len(timeseries["values"]) == 3
        assert timeseries["yAxis"] == "p95()"
        assert timeseries["groupBy"] == [{"key": "message", "value": "very bad"}]
        assert timeseries["meta"] == {
            "order": 0,
            "isOther": False,
            "valueUnit": "millisecond",
            "valueType": "duration",
            "interval": 3_600_000,
        }
        assert timeseries["values"] == [
            {
                "incomplete": False,
                "timestamp": self.start.timestamp() * 1000,
                "value": 120000.0,
            },
            {
                "incomplete": False,
                "timestamp": self.start.timestamp() * 1000 + 3_600_000 * 1,
                "value": 120000.0,
            },
            {
                "incomplete": False,
                "timestamp": self.start.timestamp() * 1000 + 3_600_000 * 2,
                "value": 0,
            },
        ]

        timeseries = response.data["timeSeries"][2]
        assert len(timeseries["values"]) == 3
        assert timeseries["yAxis"] == "count()"
        assert timeseries["groupBy"] == [{"key": "message", "value": "oh my"}]
        assert timeseries["meta"] == {
            "order": 1,
            "isOther": False,
            "valueType": "integer",
            "valueUnit": None,
            "interval": 3_600_000,
        }
        assert timeseries["values"] == [
            {
                "incomplete": False,
                "timestamp": self.start.timestamp() * 1000,
                "value": 0,
            },
            {
                "incomplete": False,
                "timestamp": self.start.timestamp() * 1000 + 3_600_000 * 1,
                "value": 1,
            },
            {
                "incomplete": False,
                "timestamp": self.start.timestamp() * 1000 + 3_600_000 * 2,
                "value": 0,
            },
        ]

        timeseries = response.data["timeSeries"][3]
        assert len(timeseries["values"]) == 3
        assert timeseries["yAxis"] == "p95()"
        assert timeseries["groupBy"] == [{"key": "message", "value": "oh my"}]
        assert timeseries["meta"] == {
            "order": 1,
            "isOther": False,
            "valueUnit": "millisecond",
            "valueType": "duration",
            "interval": 3_600_000,
        }
        assert timeseries["values"] == [
            {
                "incomplete": False,
                "timestamp": self.start.timestamp() * 1000,
                "value": 0,
            },
            {
                "incomplete": False,
                "timestamp": self.start.timestamp() * 1000 + 3_600_000 * 1,
                "value": 120000.0,
            },
            {
                "incomplete": False,
                "timestamp": self.start.timestamp() * 1000 + 3_600_000 * 2,
                "value": 0,
            },
        ]

    def test_incomplete_bucket(self):
        with freeze_time(self.end):
            response = self.do_request(
                {
                    "start": self.start,
                    "end": self.end,
                    "interval": "1h",
                    "project": [self.project.id, self.project2.id],
                },
            )
        assert response.status_code == 200, response.content
        assert response.data["meta"] == {
            "dataset": "discover",
            "start": self.start.timestamp() * 1000,
            "end": self.end.timestamp() * 1000,
        }
        assert len(response.data["timeSeries"]) == 1
        timeseries = response.data["timeSeries"][0]
        assert len(timeseries["values"]) == 3
        assert timeseries["yAxis"] == "count()"
        assert timeseries["values"] == [
            {
                "incomplete": False,
                "timestamp": self.start.timestamp() * 1000,
                "value": 1,
            },
            {
                "incomplete": True,
                "incompleteReason": INGESTION_DELAY_MESSAGE,
                "timestamp": self.start.timestamp() * 1000 + 3_600_000 * 1,
                "value": 2,
            },
            {
                "incomplete": True,
                "incompleteReason": INGESTION_DELAY_MESSAGE,
                "timestamp": self.start.timestamp() * 1000 + 3_600_000 * 2,
                "value": 0,
            },
        ]
        assert timeseries["meta"] == {
            "valueType": "integer",
            "valueUnit": None,
            "interval": 3_600_000,
        }
