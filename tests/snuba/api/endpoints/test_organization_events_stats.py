from __future__ import annotations

import uuid
from datetime import timedelta
from typing import Any, TypedDict
from unittest import mock
from uuid import uuid4

import pytest
from dateutil.parser import parse as parse_date
from django.urls import reverse
from snuba_sdk import Entity
from snuba_sdk.column import Column
from snuba_sdk.conditions import Condition, Op
from snuba_sdk.function import Function

from sentry.constants import MAX_TOP_EVENTS
from sentry.issues.grouptype import ProfileFileIOGroupType
from sentry.models.project import Project
from sentry.models.transaction_threshold import ProjectTransactionThreshold, TransactionMetric
from sentry.snuba.discover import OTHER_KEY
from sentry.testutils.cases import APITestCase, ProfilesSnubaTestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.utils.samples import load_data
from tests.sentry.issues.test_utils import SearchIssueTestMixin

pytestmark = pytest.mark.sentry_metrics


class _EventDataDict(TypedDict):
    data: dict[str, Any]
    project: Project
    count: int


class OrganizationEventsStatsEndpointTest(APITestCase, SnubaTestCase, SearchIssueTestMixin):
    endpoint = "sentry-api-0-organization-events-stats"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.authed_user = self.user

        self.day_ago = before_now(days=1).replace(hour=10, minute=0, second=0, microsecond=0)

        self.project = self.create_project()
        self.project2 = self.create_project()
        self.user = self.create_user()
        self.user2 = self.create_user()
        self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "very bad",
                "timestamp": (self.day_ago + timedelta(minutes=1)).isoformat(),
                "fingerprint": ["group1"],
                "tags": {"sentry:user": self.user.email},
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "event_id": "b" * 32,
                "message": "oh my",
                "timestamp": (self.day_ago + timedelta(hours=1, minutes=1)).isoformat(),
                "fingerprint": ["group2"],
                "tags": {"sentry:user": self.user2.email},
            },
            project_id=self.project2.id,
        )
        self.store_event(
            data={
                "event_id": "c" * 32,
                "message": "very bad",
                "timestamp": (self.day_ago + timedelta(hours=1, minutes=2)).isoformat(),
                "fingerprint": ["group2"],
                "tags": {"sentry:user": self.user2.email},
            },
            project_id=self.project2.id,
        )
        self.url = reverse(
            "sentry-api-0-organization-events-stats",
            kwargs={"organization_id_or_slug": self.project.organization.slug},
        )
        self.features = {}

    def do_request(self, data, url=None, features=None):
        if features is None:
            features = {"organizations:discover-basic": True}
        features.update(self.features)
        with self.feature(features):
            return self.client.get(self.url if url is None else url, data=data, format="json")

    @pytest.mark.querybuilder
    def test_simple(self):
        response = self.do_request(
            {
                "start": self.day_ago,
                "end": self.day_ago + timedelta(hours=2),
                "interval": "1h",
            },
        )
        assert response.status_code == 200, response.content
        assert [attrs for time, attrs in response.data["data"]] == [[{"count": 1}], [{"count": 2}]]

    def test_generic_issue(self):
        _, _, group_info = self.store_search_issue(
            self.project.id,
            self.user.id,
            [f"{ProfileFileIOGroupType.type_id}-group1"],
            "prod",
            self.day_ago,
        )
        assert group_info is not None
        self.store_search_issue(
            self.project.id,
            self.user.id,
            [f"{ProfileFileIOGroupType.type_id}-group1"],
            "prod",
            self.day_ago + timedelta(hours=1, minutes=1),
        )
        self.store_search_issue(
            self.project.id,
            self.user.id,
            [f"{ProfileFileIOGroupType.type_id}-group1"],
            "prod",
            self.day_ago + timedelta(hours=1, minutes=2),
        )
        with self.feature(
            [
                "organizations:profiling",
            ]
        ):
            response = self.do_request(
                {
                    "start": self.day_ago,
                    "end": self.day_ago + timedelta(hours=2),
                    "interval": "1h",
                    "query": f"issue:{group_info.group.qualified_short_id}",
                    "dataset": "issuePlatform",
                },
            )
        assert response.status_code == 200, response.content
        assert [attrs for time, attrs in response.data["data"]] == [[{"count": 1}], [{"count": 2}]]

    def test_generic_issue_calculated_interval(self):
        """Test that a 4h interval returns the correct generic event stats.
        This follows a different code path than 1h or 1d as the IssuePlatformTimeSeriesQueryBuilder
        does some calculation to create the time column."""
        _, _, group_info = self.store_search_issue(
            self.project.id,
            self.user.id,
            [f"{ProfileFileIOGroupType.type_id}-group1"],
            "prod",
            self.day_ago + timedelta(minutes=1),
        )
        assert group_info is not None
        self.store_search_issue(
            self.project.id,
            self.user.id,
            [f"{ProfileFileIOGroupType.type_id}-group1"],
            "prod",
            self.day_ago + timedelta(minutes=1),
        )
        self.store_search_issue(
            self.project.id,
            self.user.id,
            [f"{ProfileFileIOGroupType.type_id}-group1"],
            "prod",
            self.day_ago + timedelta(minutes=2),
        )
        with self.feature(
            [
                "organizations:profiling",
            ]
        ):
            response = self.do_request(
                {
                    "start": self.day_ago,
                    "end": self.day_ago + timedelta(hours=4),
                    "interval": "4h",
                    "query": f"issue:{group_info.group.qualified_short_id}",
                    "dataset": "issuePlatform",
                },
            )
        assert response.status_code == 200, response.content
        assert [attrs for time, attrs in response.data["data"]] == [[{"count": 3}], [{"count": 0}]]

    def test_errors_dataset(self):
        response = self.do_request(
            {
                "start": self.day_ago,
                "end": self.day_ago + timedelta(hours=2),
                "interval": "1h",
                "dataset": "errors",
                "query": "is:unresolved",
            },
        )
        assert response.status_code == 200, response.content
        assert [attrs for time, attrs in response.data["data"]] == [[{"count": 1}], [{"count": 2}]]

    def test_errors_dataset_no_query(self):
        response = self.do_request(
            {
                "start": self.day_ago,
                "end": self.day_ago + timedelta(hours=2),
                "interval": "1h",
                "dataset": "errors",
            },
        )
        assert response.status_code == 200, response.content
        assert [attrs for time, attrs in response.data["data"]] == [[{"count": 1}], [{"count": 2}]]

    def test_misaligned_last_bucket(self):
        response = self.do_request(
            data={
                "start": self.day_ago - timedelta(minutes=30),
                "end": self.day_ago + timedelta(hours=1, minutes=30),
                "interval": "1h",
                "partial": "1",
            },
        )

        assert response.status_code == 200, response.content
        assert [attrs for time, attrs in response.data["data"]] == [
            [{"count": 0}],
            [{"count": 1}],
            [{"count": 2}],
        ]

    def test_no_projects(self):
        org = self.create_organization(owner=self.user)
        self.login_as(user=self.user)

        url = reverse(
            "sentry-api-0-organization-events-stats", kwargs={"organization_id_or_slug": org.slug}
        )
        response = self.do_request({}, url)

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 0

    def test_user_count(self):
        self.store_event(
            data={
                "event_id": "d" * 32,
                "message": "something",
                "timestamp": (self.day_ago + timedelta(minutes=2)).isoformat(),
                "tags": {"sentry:user": self.user2.email},
                "fingerprint": ["group2"],
            },
            project_id=self.project2.id,
        )
        response = self.do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(hours=2),
                "interval": "1h",
                "yAxis": "user_count",
            },
        )
        assert response.status_code == 200, response.content
        assert [attrs for time, attrs in response.data["data"]] == [[{"count": 2}], [{"count": 1}]]

    def test_discover2_backwards_compatibility(self):
        response = self.do_request(
            data={
                "project": self.project.id,
                "start": self.day_ago,
                "end": self.day_ago + timedelta(hours=2),
                "interval": "1h",
                "yAxis": "user_count",
            },
        )
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) > 0

        response = self.do_request(
            data={
                "project": self.project.id,
                "start": self.day_ago,
                "end": self.day_ago + timedelta(hours=2),
                "interval": "1h",
                "yAxis": "event_count",
            },
        )
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) > 0

    def test_with_event_count_flag(self):
        response = self.do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(hours=2),
                "interval": "1h",
                "yAxis": "event_count",
            },
        )

        assert response.status_code == 200, response.content
        assert [attrs for time, attrs in response.data["data"]] == [[{"count": 1}], [{"count": 2}]]

    def test_performance_view_feature(self):
        response = self.do_request(
            data={
                "end": before_now(),
                "start": before_now(hours=2),
                "query": "project_id:1",
                "interval": "30m",
                "yAxis": "count()",
            },
            features={
                "organizations:performance-view": True,
                "organizations:discover-basic": False,
            },
        )
        assert response.status_code == 200, response.content

    def test_apdex_divide_by_zero(self):
        ProjectTransactionThreshold.objects.create(
            project=self.project,
            organization=self.project.organization,
            threshold=600,
            metric=TransactionMetric.LCP.value,
        )

        # Shouldn't count towards apdex
        data = load_data(
            "transaction",
            start_timestamp=self.day_ago + timedelta(minutes=(1)),
            timestamp=self.day_ago + timedelta(minutes=(3)),
        )
        data["transaction"] = "/apdex/new/"
        data["user"] = {"email": "1@example.com"}
        data["measurements"] = {}
        self.store_event(data, project_id=self.project.id)

        response = self.do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(hours=2),
                "interval": "1h",
                "yAxis": "apdex()",
                "project": [self.project.id],
            },
        )

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 2
        data = response.data["data"]
        # 0 transactions with LCP 0/0
        assert [attrs for time, attrs in response.data["data"]] == [
            [{"count": 0}],
            [{"count": 0}],
        ]

    def test_aggregate_function_apdex(self):
        project1 = self.create_project()
        project2 = self.create_project()

        events = [
            ("one", 400, project1.id),
            ("one", 400, project1.id),
            ("two", 3000, project2.id),
            ("two", 1000, project2.id),
            ("three", 3000, project2.id),
        ]
        for idx, event in enumerate(events):
            data = load_data(
                "transaction",
                start_timestamp=self.day_ago + timedelta(minutes=(1 + idx)),
                timestamp=self.day_ago + timedelta(minutes=(1 + idx), milliseconds=event[1]),
            )
            data["event_id"] = f"{idx}" * 32
            data["transaction"] = f"/apdex/new/{event[0]}"
            data["user"] = {"email": f"{idx}@example.com"}
            self.store_event(data, project_id=event[2])

        response = self.do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(hours=2),
                "interval": "1h",
                "yAxis": "apdex()",
            },
        )
        assert response.status_code == 200, response.content

        assert [attrs for time, attrs in response.data["data"]] == [
            [{"count": 0.3}],
            [{"count": 0}],
        ]

        ProjectTransactionThreshold.objects.create(
            project=project1,
            organization=project1.organization,
            threshold=100,
            metric=TransactionMetric.DURATION.value,
        )

        ProjectTransactionThreshold.objects.create(
            project=project2,
            organization=project1.organization,
            threshold=100,
            metric=TransactionMetric.DURATION.value,
        )

        response = self.do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(hours=2),
                "interval": "1h",
                "yAxis": "apdex()",
            },
        )
        assert response.status_code == 200, response.content

        assert [attrs for time, attrs in response.data["data"]] == [
            [{"count": 0.2}],
            [{"count": 0}],
        ]

        response = self.do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(hours=2),
                "interval": "1h",
                "yAxis": ["user_count", "apdex()"],
            },
        )

        assert response.status_code == 200, response.content
        assert response.data["user_count"]["order"] == 0
        assert [attrs for time, attrs in response.data["user_count"]["data"]] == [
            [{"count": 5}],
            [{"count": 0}],
        ]
        assert response.data["apdex()"]["order"] == 1
        assert [attrs for time, attrs in response.data["apdex()"]["data"]] == [
            [{"count": 0.2}],
            [{"count": 0}],
        ]

    def test_aggregate_function_count(self):
        response = self.do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(hours=2),
                "interval": "1h",
                "yAxis": "count()",
            },
        )
        assert response.status_code == 200, response.content
        assert [attrs for time, attrs in response.data["data"]] == [[{"count": 1}], [{"count": 2}]]

    def test_invalid_aggregate(self):
        response = self.do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(hours=2),
                "interval": "1h",
                "yAxis": "rubbish",
            },
        )
        assert response.status_code == 400, response.content

    def test_aggregate_function_user_count(self):
        response = self.do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(hours=2),
                "interval": "1h",
                "yAxis": "count_unique(user)",
            },
        )
        assert response.status_code == 200, response.content
        assert [attrs for time, attrs in response.data["data"]] == [[{"count": 1}], [{"count": 1}]]

    def test_aggregate_invalid(self):
        response = self.do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(hours=2),
                "interval": "1h",
                "yAxis": "nope(lol)",
            },
        )
        assert response.status_code == 400, response.content

    def test_throughput_meta(self):
        project = self.create_project()
        # Each of these denotes how many events to create in each hour
        event_counts = [6, 0, 6, 3, 0, 3]
        for hour, count in enumerate(event_counts):
            for minute in range(count):
                self.store_event(
                    data={
                        "event_id": str(uuid.uuid1()),
                        "message": "very bad",
                        "timestamp": (
                            self.day_ago + timedelta(hours=hour, minutes=minute)
                        ).isoformat(),
                        "fingerprint": ["group1"],
                        "tags": {"sentry:user": self.user.email},
                    },
                    project_id=project.id,
                )

        for axis in ["epm()", "tpm()"]:
            response = self.do_request(
                data={
                    "transformAliasToInputFormat": 1,
                    "start": self.day_ago,
                    "end": self.day_ago + timedelta(hours=6),
                    "interval": "1h",
                    "yAxis": axis,
                    "project": project.id,
                },
            )
            meta = response.data["meta"]
            assert meta["fields"] == {
                "time": "date",
                axis: "rate",
            }
            assert meta["units"] == {"time": None, axis: "1/minute"}

            data = response.data["data"]
            assert len(data) == 6

            rows = data[0:6]
            for test in zip(event_counts, rows):
                assert test[1][1][0]["count"] == test[0] / (3600.0 / 60.0)

        for axis in ["eps()", "tps()"]:
            response = self.do_request(
                data={
                    "transformAliasToInputFormat": 1,
                    "start": self.day_ago,
                    "end": self.day_ago + timedelta(hours=6),
                    "interval": "1h",
                    "yAxis": axis,
                    "project": project.id,
                },
            )
            meta = response.data["meta"]
            assert meta["fields"] == {
                "time": "date",
                axis: "rate",
            }
            assert meta["units"] == {"time": None, axis: "1/second"}

    def test_multi_series_meta(self):
        project = self.create_project()
        # Each of these denotes how many events to create in each hour
        event_counts = [6, 0, 6, 3, 0, 3]
        for hour, count in enumerate(event_counts):
            for minute in range(count):
                self.store_event(
                    data={
                        "event_id": str(uuid.uuid1()),
                        "message": "very bad",
                        "timestamp": (
                            self.day_ago + timedelta(hours=hour, minutes=minute)
                        ).isoformat(),
                        "fingerprint": ["group1"],
                        "tags": {"sentry:user": self.user.email},
                    },
                    project_id=project.id,
                )

        response = self.do_request(
            data={
                "transformAliasToInputFormat": 1,
                "start": self.day_ago,
                "end": self.day_ago + timedelta(hours=6),
                "interval": "1h",
                "yAxis": ["epm()", "count()"],
                "project": project.id,
            },
        )

        assert response.data["epm()"]["meta"]["fields"] == {
            "time": "date",
            "epm()": "rate",
        }

        assert response.data["epm()"]["meta"]["units"] == {
            "time": None,
            "epm()": "1/minute",
        }

        assert response.data["count()"]["meta"]["fields"] == {
            "time": "date",
            "count()": "integer",
        }

        assert response.data["count()"]["meta"]["units"] == {
            "time": None,
            "count()": None,
        }

    def test_throughput_epm_hour_rollup(self):
        project = self.create_project()
        # Each of these denotes how many events to create in each hour
        event_counts = [6, 0, 6, 3, 0, 3]
        for hour, count in enumerate(event_counts):
            for minute in range(count):
                self.store_event(
                    data={
                        "event_id": str(uuid.uuid1()),
                        "message": "very bad",
                        "timestamp": (
                            self.day_ago + timedelta(hours=hour, minutes=minute)
                        ).isoformat(),
                        "fingerprint": ["group1"],
                        "tags": {"sentry:user": self.user.email},
                    },
                    project_id=project.id,
                )

        for axis in ["epm()", "tpm()"]:
            response = self.do_request(
                data={
                    "start": self.day_ago,
                    "end": self.day_ago + timedelta(hours=6),
                    "interval": "1h",
                    "yAxis": axis,
                    "project": project.id,
                },
            )
            assert response.status_code == 200, response.content
            data = response.data["data"]
            assert len(data) == 6

            rows = data[0:6]
            for test in zip(event_counts, rows):
                assert test[1][1][0]["count"] == test[0] / (3600.0 / 60.0)

    def test_throughput_epm_day_rollup(self):
        project = self.create_project()
        # Each of these denotes how many events to create in each minute
        event_counts = [6, 0, 6, 3, 0, 3]
        for hour, count in enumerate(event_counts):
            for minute in range(count):
                self.store_event(
                    data={
                        "event_id": str(uuid.uuid1()),
                        "message": "very bad",
                        "timestamp": (
                            self.day_ago + timedelta(hours=hour, minutes=minute)
                        ).isoformat(),
                        "fingerprint": ["group1"],
                        "tags": {"sentry:user": self.user.email},
                    },
                    project_id=project.id,
                )

        for axis in ["epm()", "tpm()"]:
            response = self.do_request(
                data={
                    "start": self.day_ago,
                    "end": self.day_ago + timedelta(hours=24),
                    "interval": "24h",
                    "yAxis": axis,
                    "project": project.id,
                },
            )
            assert response.status_code == 200, response.content
            data = response.data["data"]
            assert len(data) == 2

            assert data[0][1][0]["count"] == sum(event_counts) / (86400.0 / 60.0)

    def test_throughput_eps_minute_rollup(self):
        project = self.create_project()
        # Each of these denotes how many events to create in each minute
        event_counts = [6, 0, 6, 3, 0, 3]
        for minute, count in enumerate(event_counts):
            for second in range(count):
                self.store_event(
                    data={
                        "event_id": str(uuid.uuid1()),
                        "message": "very bad",
                        "timestamp": (
                            self.day_ago + timedelta(minutes=minute, seconds=second)
                        ).isoformat(),
                        "fingerprint": ["group1"],
                        "tags": {"sentry:user": self.user.email},
                    },
                    project_id=project.id,
                )

        for axis in ["eps()", "tps()"]:
            response = self.do_request(
                data={
                    "start": self.day_ago,
                    "end": self.day_ago + timedelta(minutes=6),
                    "interval": "1m",
                    "yAxis": axis,
                    "project": project.id,
                },
            )
            assert response.status_code == 200, response.content
            data = response.data["data"]
            assert len(data) == 6

            rows = data[0:6]
            for test in zip(event_counts, rows):
                assert test[1][1][0]["count"] == test[0] / 60.0

    def test_throughput_eps_no_rollup(self):
        project = self.create_project()
        # Each of these denotes how many events to create in each minute
        event_counts = [6, 0, 6, 3, 0, 3]
        for minute, count in enumerate(event_counts):
            for second in range(count):
                self.store_event(
                    data={
                        "event_id": str(uuid.uuid1()),
                        "message": "very bad",
                        "timestamp": (
                            self.day_ago + timedelta(minutes=minute, seconds=second)
                        ).isoformat(),
                        "fingerprint": ["group1"],
                        "tags": {"sentry:user": self.user.email},
                    },
                    project_id=project.id,
                )

        response = self.do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(minutes=1),
                "interval": "1s",
                "yAxis": "eps()",
                "project": project.id,
            },
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]

        # expect 60 data points between time span of 0 and 60 seconds
        assert len(data) == 60

        rows = data[0:6]

        for row in rows:
            assert row[1][0]["count"] == 1

    def test_transaction_events(self):
        prototype = {
            "type": "transaction",
            "transaction": "api.issue.delete",
            "spans": [],
            "contexts": {"trace": {"op": "foobar", "trace_id": "a" * 32, "span_id": "a" * 16}},
            "tags": {"important": "yes"},
        }
        fixtures = (
            ("d" * 32, before_now(minutes=32)),
            ("e" * 32, before_now(hours=1, minutes=2)),
            ("f" * 32, before_now(hours=1, minutes=35)),
        )
        for fixture in fixtures:
            data = prototype.copy()
            data["event_id"] = fixture[0]
            data["timestamp"] = fixture[1].isoformat()
            data["start_timestamp"] = (fixture[1] - timedelta(seconds=1)).isoformat()
            self.store_event(data=data, project_id=self.project.id)

        for dataset in ["discover", "transactions"]:
            response = self.do_request(
                data={
                    "project": self.project.id,
                    "end": before_now(),
                    "start": before_now(hours=2),
                    "query": "event.type:transaction",
                    "interval": "30m",
                    "yAxis": "count()",
                    "dataset": dataset,
                },
            )
            assert response.status_code == 200, response.content
            items = [item for time, item in response.data["data"] if item]
            # We could get more results depending on where the 30 min
            # windows land.
            assert len(items) >= 3

    def test_project_id_query_filter(self):
        response = self.do_request(
            data={
                "end": before_now(),
                "start": before_now(hours=2),
                "query": "project_id:1",
                "interval": "30m",
                "yAxis": "count()",
            },
        )
        assert response.status_code == 200

    def test_latest_release_query_filter(self):
        response = self.do_request(
            data={
                "project": self.project.id,
                "end": before_now(),
                "start": before_now(hours=2),
                "query": "release:latest",
                "interval": "30m",
                "yAxis": "count()",
            },
        )
        assert response.status_code == 200

    def test_conditional_filter(self):
        response = self.do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(hours=2),
                "query": "id:{} OR id:{}".format("a" * 32, "b" * 32),
                "interval": "30m",
                "yAxis": "count()",
            },
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 4
        assert data[0][1][0]["count"] == 1
        assert data[2][1][0]["count"] == 1

    def test_simple_multiple_yaxis(self):
        response = self.do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(hours=2),
                "interval": "1h",
                "yAxis": ["user_count", "event_count"],
            },
        )

        assert response.status_code == 200, response.content
        assert response.data["user_count"]["order"] == 0
        assert [attrs for time, attrs in response.data["user_count"]["data"]] == [
            [{"count": 1}],
            [{"count": 1}],
        ]
        assert response.data["event_count"]["order"] == 1
        assert [attrs for time, attrs in response.data["event_count"]["data"]] == [
            [{"count": 1}],
            [{"count": 2}],
        ]

    def test_equation_yaxis(self):
        response = self.do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(hours=2),
                "interval": "1h",
                "yAxis": ["equation|count() / 100"],
            },
        )

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 2
        assert [attrs for time, attrs in response.data["data"]] == [
            [{"count": 0.01}],
            [{"count": 0.02}],
        ]

    def test_eps_equation(self):
        response = self.do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(hours=2),
                "interval": "1h",
                "yAxis": ["equation|eps() * 2"],
            },
        )

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 2
        assert pytest.approx(0.000556, abs=0.0001) == response.data["data"][0][1][0]["count"]
        assert pytest.approx(0.001112, abs=0.0001) == response.data["data"][1][1][0]["count"]

    def test_epm_equation(self):
        response = self.do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(hours=2),
                "interval": "1h",
                "yAxis": ["equation|epm() * 2"],
            },
        )

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 2
        assert pytest.approx(0.03334, abs=0.01) == response.data["data"][0][1][0]["count"]
        assert pytest.approx(0.06667, abs=0.01) == response.data["data"][1][1][0]["count"]

    def test_equation_mixed_multi_yaxis(self):
        response = self.do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(hours=2),
                "interval": "1h",
                "yAxis": ["count()", "equation|count() * 100"],
            },
        )

        assert response.status_code == 200, response.content
        assert response.data["count()"]["order"] == 0
        assert [attrs for time, attrs in response.data["count()"]["data"]] == [
            [{"count": 1}],
            [{"count": 2}],
        ]
        assert response.data["equation|count() * 100"]["order"] == 1
        assert [attrs for time, attrs in response.data["equation|count() * 100"]["data"]] == [
            [{"count": 100}],
            [{"count": 200}],
        ]

    def test_equation_multi_yaxis(self):
        response = self.do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(hours=2),
                "interval": "1h",
                "yAxis": ["equation|count() / 100", "equation|count() * 100"],
            },
        )

        assert response.status_code == 200, response.content
        assert response.data["equation|count() / 100"]["order"] == 0
        assert [attrs for time, attrs in response.data["equation|count() / 100"]["data"]] == [
            [{"count": 0.01}],
            [{"count": 0.02}],
        ]
        assert response.data["equation|count() * 100"]["order"] == 1
        assert [attrs for time, attrs in response.data["equation|count() * 100"]["data"]] == [
            [{"count": 100}],
            [{"count": 200}],
        ]

    def test_large_interval_no_drop_values(self):
        self.store_event(
            data={
                "event_id": "d" * 32,
                "message": "not good",
                "timestamp": (self.day_ago - timedelta(minutes=10)).isoformat(),
                "fingerprint": ["group3"],
            },
            project_id=self.project.id,
        )

        response = self.do_request(
            data={
                "project": self.project.id,
                "end": self.day_ago,
                "start": self.day_ago - timedelta(hours=24),
                "query": 'message:"not good"',
                "interval": "1d",
                "yAxis": "count()",
            },
        )
        assert response.status_code == 200
        assert [attrs for time, attrs in response.data["data"]] == [[{"count": 0}], [{"count": 1}]]

    @mock.patch("sentry.snuba.discover.timeseries_query", return_value={})
    def test_multiple_yaxis_only_one_query(self, mock_query):
        self.do_request(
            data={
                "project": self.project.id,
                "start": self.day_ago,
                "end": self.day_ago + timedelta(hours=2),
                "interval": "1h",
                "yAxis": ["user_count", "event_count", "epm()", "eps()"],
            },
        )

        assert mock_query.call_count == 1

    @mock.patch("sentry.snuba.discover.bulk_snuba_queries", return_value=[{"data": []}])
    def test_invalid_interval(self, mock_query):
        self.do_request(
            data={
                "end": before_now(),
                "start": before_now(hours=24),
                "query": "",
                "interval": "1s",
                "yAxis": "count()",
            },
        )
        assert mock_query.call_count == 1
        # Should've reset to the default for 24h
        assert mock_query.mock_calls[0].args[0][0].query.granularity.granularity == 300

        self.do_request(
            data={
                "end": before_now(),
                "start": before_now(hours=24),
                "query": "",
                "interval": "0d",
                "yAxis": "count()",
            },
        )
        assert mock_query.call_count == 2
        # Should've reset to the default for 24h
        assert mock_query.mock_calls[1].args[0][0].query.granularity.granularity == 300

    def test_out_of_retention(self):
        with self.options({"system.event-retention-days": 10}):
            response = self.do_request(
                data={
                    "start": before_now(days=20),
                    "end": before_now(days=15),
                    "query": "",
                    "interval": "30m",
                    "yAxis": "count()",
                },
            )
        assert response.status_code == 400

    @mock.patch("sentry.utils.snuba.quantize_time")
    def test_quantize_dates(self, mock_quantize):
        mock_quantize.return_value = before_now(days=1)
        # Don't quantize short time periods
        self.do_request(
            data={"statsPeriod": "1h", "query": "", "interval": "30m", "yAxis": "count()"},
        )
        # Don't quantize absolute date periods
        self.do_request(
            data={
                "start": before_now(days=20),
                "end": before_now(days=15),
                "query": "",
                "interval": "30m",
                "yAxis": "count()",
            },
        )

        assert len(mock_quantize.mock_calls) == 0

        # Quantize long date periods
        self.do_request(
            data={"statsPeriod": "90d", "query": "", "interval": "30m", "yAxis": "count()"},
        )

        assert len(mock_quantize.mock_calls) == 2

    def test_with_zerofill(self):
        response = self.do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(hours=2),
                "interval": "30m",
            },
        )

        assert response.status_code == 200, response.content
        assert [attrs for time, attrs in response.data["data"]] == [
            [{"count": 1}],
            [{"count": 0}],
            [{"count": 2}],
            [{"count": 0}],
        ]

    def test_without_zerofill(self):
        start = self.day_ago.isoformat()
        end = (self.day_ago + timedelta(hours=2)).isoformat()
        response = self.do_request(
            data={
                "start": start,
                "end": end,
                "interval": "30m",
                "withoutZerofill": "1",
            },
            features={
                "organizations:performance-chart-interpolation": True,
                "organizations:discover-basic": True,
            },
        )

        assert response.status_code == 200, response.content
        assert [attrs for time, attrs in response.data["data"]] == [
            [{"count": 1}],
            [{"count": 2}],
        ]
        assert response.data["start"] == parse_date(start).timestamp()
        assert response.data["end"] == parse_date(end).timestamp()

    def test_comparison_error_dataset(self):
        self.store_event(
            data={
                "timestamp": (self.day_ago + timedelta(days=-1, minutes=1)).isoformat(),
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "timestamp": (self.day_ago + timedelta(days=-1, minutes=2)).isoformat(),
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "timestamp": (self.day_ago + timedelta(days=-1, hours=1, minutes=1)).isoformat(),
            },
            project_id=self.project2.id,
        )

        response = self.do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(hours=2),
                "interval": "1h",
                "comparisonDelta": int(timedelta(days=1).total_seconds()),
                "dataset": "errors",
            }
        )
        assert response.status_code == 200, response.content

        assert [attrs for time, attrs in response.data["data"]] == [
            [{"count": 1, "comparisonCount": 2}],
            [{"count": 2, "comparisonCount": 1}],
        ]

    def test_comparison(self):
        self.store_event(
            data={
                "timestamp": (self.day_ago + timedelta(days=-1, minutes=1)).isoformat(),
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "timestamp": (self.day_ago + timedelta(days=-1, minutes=2)).isoformat(),
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "timestamp": (self.day_ago + timedelta(days=-1, hours=1, minutes=1)).isoformat(),
            },
            project_id=self.project2.id,
        )

        response = self.do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(hours=2),
                "interval": "1h",
                "comparisonDelta": int(timedelta(days=1).total_seconds()),
            }
        )
        assert response.status_code == 200, response.content

        assert [attrs for time, attrs in response.data["data"]] == [
            [{"count": 1, "comparisonCount": 2}],
            [{"count": 2, "comparisonCount": 1}],
        ]

    def test_comparison_invalid(self):
        response = self.do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(hours=2),
                "interval": "1h",
                "comparisonDelta": "17h",
            },
        )
        assert response.status_code == 400, response.content
        assert response.data["detail"] == "comparisonDelta must be an integer"

        start = before_now(days=85)
        end = start + timedelta(days=7)
        with self.options({"system.event-retention-days": 90}):
            response = self.do_request(
                data={
                    "start": start,
                    "end": end,
                    "interval": "1h",
                    "comparisonDelta": int(timedelta(days=7).total_seconds()),
                }
            )
            assert response.status_code == 400, response.content
            assert response.data["detail"] == "Comparison period is outside retention window"

    def test_equations_divide_by_zero(self):
        response = self.do_request(
            data={
                "start": self.day_ago,
                "end": self.day_ago + timedelta(hours=2),
                "interval": "1h",
                # force a 0 in the denominator by doing 1 - 1
                # since a 0 literal is illegal as the denominator
                "yAxis": ["equation|count() / (1-1)"],
            },
        )

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 2
        assert [attrs for time, attrs in response.data["data"]] == [
            [{"count": None}],
            [{"count": None}],
        ]

    @mock.patch("sentry.search.events.builder.base.raw_snql_query")
    def test_profiles_dataset_simple(self, mock_snql_query):
        mock_snql_query.side_effect = [{"meta": {}, "data": []}]

        query = {
            "yAxis": [
                "count()",
                "p75()",
                "p95()",
                "p99()",
                "p75(profile.duration)",
                "p95(profile.duration)",
                "p99(profile.duration)",
            ],
            "project": [self.project.id],
            "dataset": "profiles",
        }
        response = self.do_request(query, features={"organizations:profiling": True})
        assert response.status_code == 200, response.content

    def test_tag_with_conflicting_function_alias_simple(self):
        for _ in range(7):
            self.store_event(
                data={
                    "timestamp": (self.day_ago + timedelta(minutes=2)).isoformat(),
                    "tags": {"count": "9001"},
                },
                project_id=self.project2.id,
            )

        # Query for count and count()
        data = {
            "start": self.day_ago.isoformat(),
            "end": (self.day_ago + timedelta(minutes=3)).isoformat(),
            "interval": "1h",
            "yAxis": "count()",
            "orderby": ["-count()"],
            "field": ["count()", "count"],
            "partial": "1",
        }
        response = self.client.get(self.url, data, format="json")
        assert response.status_code == 200
        # Expect a count of 8 because one event from setUp
        assert response.data["data"][0][1] == [{"count": 8}]

        data["query"] = "count:9001"
        response = self.client.get(self.url, data, format="json")
        assert response.status_code == 200
        assert response.data["data"][0][1] == [{"count": 7}]

        data["query"] = "count:abc"
        response = self.client.get(self.url, data, format="json")
        assert response.status_code == 200
        assert all([interval[1][0]["count"] == 0 for interval in response.data["data"]])

    def test_group_id_tag_simple(self):
        event_data: _EventDataDict = {
            "data": {
                "message": "poof",
                "timestamp": (self.day_ago + timedelta(minutes=2)).isoformat(),
                "user": {"email": self.user.email},
                "tags": {"group_id": "testing"},
                "fingerprint": ["group1"],
            },
            "project": self.project2,
            "count": 7,
        }
        for i in range(event_data["count"]):
            event_data["data"]["event_id"] = f"a{i}" * 16
            self.store_event(event_data["data"], project_id=event_data["project"].id)

        data = {
            "start": self.day_ago.isoformat(),
            "end": (self.day_ago + timedelta(hours=2)).isoformat(),
            "interval": "1h",
            "yAxis": "count()",
            "orderby": ["-count()"],
            "field": ["count()", "group_id"],
            "partial": "1",
        }
        response = self.client.get(self.url, data, format="json")
        assert response.status_code == 200
        assert response.data["data"][0][1] == [{"count": 8}]

        data["query"] = "group_id:testing"
        response = self.client.get(self.url, data, format="json")
        assert response.status_code == 200
        assert response.data["data"][0][1] == [{"count": 7}]

        data["query"] = "group_id:abc"
        response = self.client.get(self.url, data, format="json")
        assert response.status_code == 200
        assert all([interval[1][0]["count"] == 0 for interval in response.data["data"]])


class OrganizationEventsStatsTopNEvents(APITestCase, SnubaTestCase):
    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

        self.day_ago = before_now(days=1).replace(hour=10, minute=0, second=0, microsecond=0)

        self.project = self.create_project()
        self.project2 = self.create_project()
        self.user2 = self.create_user()
        transaction_data = load_data("transaction")
        transaction_data["start_timestamp"] = (self.day_ago + timedelta(minutes=2)).isoformat()
        transaction_data["timestamp"] = (self.day_ago + timedelta(minutes=4)).isoformat()
        transaction_data["tags"] = {"shared-tag": "yup"}
        self.event_data: list[_EventDataDict] = [
            {
                "data": {
                    "message": "poof",
                    "timestamp": (self.day_ago + timedelta(minutes=2)).isoformat(),
                    "user": {"email": self.user.email},
                    "tags": {"shared-tag": "yup"},
                    "fingerprint": ["group1"],
                },
                "project": self.project2,
                "count": 7,
            },
            {
                "data": {
                    "message": "voof",
                    "timestamp": (self.day_ago + timedelta(hours=1, minutes=2)).isoformat(),
                    "fingerprint": ["group2"],
                    "user": {"email": self.user2.email},
                    "tags": {"shared-tag": "yup"},
                },
                "project": self.project2,
                "count": 6,
            },
            {
                "data": {
                    "message": "very bad",
                    "timestamp": (self.day_ago + timedelta(minutes=2)).isoformat(),
                    "fingerprint": ["group3"],
                    "user": {"email": "foo@example.com"},
                    "tags": {"shared-tag": "yup"},
                },
                "project": self.project,
                "count": 5,
            },
            {
                "data": {
                    "message": "oh no",
                    "timestamp": (self.day_ago + timedelta(minutes=2)).isoformat(),
                    "fingerprint": ["group4"],
                    "user": {"email": "bar@example.com"},
                    "tags": {"shared-tag": "yup"},
                },
                "project": self.project,
                "count": 4,
            },
            {"data": transaction_data, "project": self.project, "count": 3},
            # Not in the top 5
            {
                "data": {
                    "message": "sorta bad",
                    "timestamp": (self.day_ago + timedelta(minutes=2)).isoformat(),
                    "fingerprint": ["group5"],
                    "user": {"email": "bar@example.com"},
                    "tags": {"shared-tag": "yup"},
                },
                "project": self.project,
                "count": 2,
            },
            {
                "data": {
                    "message": "not so bad",
                    "timestamp": (self.day_ago + timedelta(minutes=2)).isoformat(),
                    "fingerprint": ["group6"],
                    "user": {"email": "bar@example.com"},
                    "tags": {"shared-tag": "yup"},
                },
                "project": self.project,
                "count": 1,
            },
        ]

        self.events = []
        for index, event_data in enumerate(self.event_data):
            data = event_data["data"].copy()
            for i in range(event_data["count"]):
                data["event_id"] = f"{index}{i}" * 16
                event = self.store_event(data, project_id=event_data["project"].id)
            self.events.append(event)
        self.transaction = self.events[4]

        self.enabled_features = {
            "organizations:discover-basic": True,
        }
        self.url = reverse(
            "sentry-api-0-organization-events-stats",
            kwargs={"organization_id_or_slug": self.project.organization.slug},
        )

    def test_no_top_events_with_project_field(self):
        project = self.create_project()
        with self.feature(self.enabled_features):
            response = self.client.get(
                self.url,
                data={
                    # make sure to query the project with 0 events
                    "project": str(project.id),
                    "start": self.day_ago.isoformat(),
                    "end": (self.day_ago + timedelta(hours=2)).isoformat(),
                    "interval": "1h",
                    "yAxis": "count()",
                    "orderby": ["-count()"],
                    "field": ["count()", "project"],
                    "topEvents": "5",
                },
                format="json",
            )

        assert response.status_code == 200, response.content
        # When there are no top events, we do not return an empty dict.
        # Instead, we return a single zero-filled series for an empty graph.
        data = response.data["data"]
        assert [attrs for time, attrs in data] == [[{"count": 0}], [{"count": 0}]]

    def test_no_top_events(self):
        project = self.create_project()
        with self.feature(self.enabled_features):
            response = self.client.get(
                self.url,
                data={
                    # make sure to query the project with 0 events
                    "project": str(project.id),
                    "start": self.day_ago.isoformat(),
                    "end": (self.day_ago + timedelta(hours=2)).isoformat(),
                    "interval": "1h",
                    "yAxis": "count()",
                    "orderby": ["-count()"],
                    "field": ["count()", "message", "user.email"],
                    "topEvents": "5",
                },
                format="json",
            )

        data = response.data["data"]
        assert response.status_code == 200, response.content
        # When there are no top events, we do not return an empty dict.
        # Instead, we return a single zero-filled series for an empty graph.
        assert [attrs for time, attrs in data] == [[{"count": 0}], [{"count": 0}]]

    def test_no_top_events_with_multi_axis(self):
        project = self.create_project()
        with self.feature(self.enabled_features):
            response = self.client.get(
                self.url,
                data={
                    # make sure to query the project with 0 events
                    "project": str(project.id),
                    "start": self.day_ago.isoformat(),
                    "end": (self.day_ago + timedelta(hours=2)).isoformat(),
                    "interval": "1h",
                    "yAxis": ["count()", "count_unique(user)"],
                    "orderby": ["-count()"],
                    "field": ["count()", "count_unique(user)", "message", "user.email"],
                    "topEvents": "5",
                },
                format="json",
            )

        assert response.status_code == 200
        data = response.data[""]
        assert [attrs for time, attrs in data["count()"]["data"]] == [
            [{"count": 0}],
            [{"count": 0}],
        ]
        assert [attrs for time, attrs in data["count_unique(user)"]["data"]] == [
            [{"count": 0}],
            [{"count": 0}],
        ]

    def test_simple_top_events(self):
        with self.feature(self.enabled_features):
            response = self.client.get(
                self.url,
                data={
                    "start": self.day_ago.isoformat(),
                    "end": (self.day_ago + timedelta(hours=2)).isoformat(),
                    "interval": "1h",
                    "yAxis": "count()",
                    "orderby": ["-count()"],
                    "field": ["count()", "message", "user.email"],
                    "topEvents": "5",
                },
                format="json",
            )

        data = response.data
        assert response.status_code == 200, response.content
        assert len(data) == 6

        for index, event in enumerate(self.events[:5]):
            message = event.message or event.transaction
            results = data[
                ",".join([message, self.event_data[index]["data"]["user"].get("email", "None")])
            ]
            assert results["order"] == index
            assert [{"count": self.event_data[index]["count"]}] in [
                attrs for _, attrs in results["data"]
            ]

        other = data["Other"]
        assert other["order"] == 5
        assert [{"count": 3}] in [attrs for _, attrs in other["data"]]

    def test_simple_top_events_meta(self):
        with self.feature(self.enabled_features):
            response = self.client.get(
                self.url,
                data={
                    "start": self.day_ago.isoformat(),
                    "end": (self.day_ago + timedelta(hours=2)).isoformat(),
                    "interval": "1h",
                    "yAxis": "sum(transaction.duration)",
                    "orderby": ["-sum(transaction.duration)"],
                    "field": ["transaction", "sum(transaction.duration)"],
                    "topEvents": "5",
                },
                format="json",
            )

        data = response.data
        assert response.status_code == 200, response.content

        for transaction, transaction_data in data.items():
            assert transaction_data["meta"]["fields"] == {
                "time": "date",
                "transaction": "string",
                "sum_transaction_duration": "duration",
            }

            assert transaction_data["meta"]["units"] == {
                "time": None,
                "transaction": None,
                "sum_transaction_duration": "millisecond",
            }

    def test_simple_top_events_meta_no_alias(self):
        with self.feature(self.enabled_features):
            response = self.client.get(
                self.url,
                data={
                    "transformAliasToInputFormat": "1",
                    "start": self.day_ago.isoformat(),
                    "end": (self.day_ago + timedelta(hours=2)).isoformat(),
                    "interval": "1h",
                    "yAxis": "sum(transaction.duration)",
                    "orderby": ["-sum(transaction.duration)"],
                    "field": ["transaction", "sum(transaction.duration)"],
                    "topEvents": "5",
                },
                format="json",
            )

        data = response.data
        assert response.status_code == 200, response.content

        for transaction, transaction_data in data.items():
            assert transaction_data["meta"]["fields"] == {
                "time": "date",
                "transaction": "string",
                "sum(transaction.duration)": "duration",
            }

            assert transaction_data["meta"]["units"] == {
                "time": None,
                "transaction": None,
                "sum(transaction.duration)": "millisecond",
            }

    def test_top_events_with_projects_other(self):
        with self.feature(self.enabled_features):
            response = self.client.get(
                self.url,
                data={
                    "start": self.day_ago.isoformat(),
                    "end": (self.day_ago + timedelta(hours=2)).isoformat(),
                    "interval": "1h",
                    "yAxis": "count()",
                    "orderby": ["-count()"],
                    "field": ["count()", "project"],
                    "topEvents": "1",
                },
                format="json",
            )

        data = response.data
        assert response.status_code == 200, response.content
        assert set(data.keys()) == {"Other", self.project.slug}

        assert data[self.project.slug]["order"] == 0
        assert [attrs[0]["count"] for _, attrs in data[self.project.slug]["data"]] == [15, 0]

        assert data["Other"]["order"] == 1
        assert [attrs[0]["count"] for _, attrs in data["Other"]["data"]] == [7, 6]

    def test_top_events_with_projects_fields(self):
        # We need to handle the project name fields differently
        for project_field in ["project", "project.name"]:
            with self.feature(self.enabled_features):
                response = self.client.get(
                    self.url,
                    data={
                        "start": self.day_ago.isoformat(),
                        "end": (self.day_ago + timedelta(hours=2)).isoformat(),
                        "interval": "1h",
                        "yAxis": "count()",
                        "orderby": ["-count()"],
                        "field": ["count()", project_field],
                        "topEvents": "5",
                    },
                    format="json",
                )

            data = response.data
            assert response.status_code == 200, response.content

            assert data[self.project.slug]["order"] == 0, project_field
            assert [attrs[0]["count"] for _, attrs in data[self.project.slug]["data"]] == [
                15,
                0,
            ], project_field

            assert data[self.project2.slug]["order"] == 1, project_field
            assert [attrs[0]["count"] for _, attrs in data[self.project2.slug]["data"]] == [
                7,
                6,
            ], project_field

    def test_tag_with_conflicting_function_alias_simple(self):
        event_data: _EventDataDict = {
            "data": {
                "message": "poof",
                "timestamp": (self.day_ago + timedelta(minutes=2)).isoformat(),
                "user": {"email": self.user.email},
                "tags": {"count": "9001"},
                "fingerprint": ["group1"],
            },
            "project": self.project2,
            "count": 7,
        }
        for i in range(event_data["count"]):
            event_data["data"]["event_id"] = f"a{i}" * 16
            self.store_event(event_data["data"], project_id=event_data["project"].id)

        # Query for count and count()
        data = {
            "start": self.day_ago.isoformat(),
            "end": (self.day_ago + timedelta(hours=2)).isoformat(),
            "interval": "1h",
            "yAxis": "count()",
            "orderby": ["-count()"],
            "field": ["count()", "count"],
            "topEvents": "5",
            "partial": "1",
        }
        with self.feature(self.enabled_features):
            response = self.client.get(self.url, data, format="json")
            assert response.status_code == 200
            assert response.data["9001"]["data"][0][1] == [{"count": 7}]

        data["query"] = "count:9001"
        with self.feature(self.enabled_features):
            response = self.client.get(self.url, data, format="json")
            assert response.status_code == 200
            assert response.data["9001"]["data"][0][1] == [{"count": 7}]

        data["query"] = "count:abc"
        with self.feature(self.enabled_features):
            response = self.client.get(self.url, data, format="json")
            assert response.status_code == 200
            assert all([interval[1][0]["count"] == 0 for interval in response.data["data"]])

    @pytest.mark.xfail(
        reason="The response.data[Other] returns 15 locally and returns 16 or 15 remotely."
    )
    def test_tag_with_conflicting_function_alias_with_other_single_grouping(self):
        event_data: list[_EventDataDict] = [
            {
                "data": {
                    "message": "poof",
                    "timestamp": self.day_ago + timedelta(minutes=2),
                    "user": {"email": self.user.email},
                    "tags": {"count": "9001"},
                    "fingerprint": ["group1"],
                },
                "project": self.project2,
                "count": 7,
            },
            {
                "data": {
                    "message": "poof2",
                    "timestamp": self.day_ago + timedelta(minutes=2),
                    "user": {"email": self.user.email},
                    "tags": {"count": "abc"},
                    "fingerprint": ["group1"],
                },
                "project": self.project2,
                "count": 3,
            },
        ]
        for index, event in enumerate(event_data):
            for i in range(event["count"]):
                event["data"]["event_id"] = f"{index}{i}" * 16
                self.store_event(event["data"], project_id=event["project"].id)

        # Query for count and count()
        data = {
            "start": self.day_ago.isoformat(),
            "end": (self.day_ago + timedelta(hours=1)).isoformat(),
            "interval": "1h",
            "yAxis": "count()",
            "orderby": ["-count"],
            "field": ["count()", "count"],
            "topEvents": "2",
            "partial": "1",
        }
        with self.feature(self.enabled_features):
            response = self.client.get(self.url, data, format="json")
            assert response.status_code == 200
            assert response.data["9001"]["data"][0][1] == [{"count": 7}]
            assert response.data["abc"]["data"][0][1] == [{"count": 3}]
            assert response.data["Other"]["data"][0][1] == [{"count": 16}]

    def test_tag_with_conflicting_function_alias_with_other_multiple_groupings(self):
        event_data: list[_EventDataDict] = [
            {
                "data": {
                    "message": "abc",
                    "timestamp": (self.day_ago + timedelta(minutes=2)).isoformat(),
                    "user": {"email": self.user.email},
                    "tags": {"count": "2"},
                    "fingerprint": ["group1"],
                },
                "project": self.project2,
                "count": 3,
            },
            {
                "data": {
                    "message": "def",
                    "timestamp": (self.day_ago + timedelta(minutes=2)).isoformat(),
                    "user": {"email": self.user.email},
                    "tags": {"count": "9001"},
                    "fingerprint": ["group1"],
                },
                "project": self.project2,
                "count": 7,
            },
        ]
        for index, event in enumerate(event_data):
            for i in range(event["count"]):
                event["data"]["event_id"] = f"{index}{i}" * 16
                self.store_event(event["data"], project_id=event["project"].id)

        # Query for count and count()
        data = {
            "start": self.day_ago.isoformat(),
            "end": (self.day_ago + timedelta(hours=2)).isoformat(),
            "interval": "2d",
            "yAxis": "count()",
            "orderby": ["-count"],
            "field": ["count()", "count", "message"],
            "topEvents": "2",
            "partial": "1",
        }
        with self.feature(self.enabled_features):
            response = self.client.get(self.url, data, format="json")
            assert response.status_code == 200
            assert response.data["abc,2"]["data"][0][1] == [{"count": 3}]
            assert response.data["def,9001"]["data"][0][1] == [{"count": 7}]
            assert response.data["Other"]["data"][0][1] == [{"count": 25}]

    def test_group_id_tag_simple(self):
        event_data: _EventDataDict = {
            "data": {
                "message": "poof",
                "timestamp": (self.day_ago + timedelta(minutes=2)).isoformat(),
                "user": {"email": self.user.email},
                "tags": {"group_id": "the tag"},
                "fingerprint": ["group1"],
            },
            "project": self.project2,
            "count": 7,
        }
        for i in range(event_data["count"]):
            event_data["data"]["event_id"] = f"a{i}" * 16
            self.store_event(event_data["data"], project_id=event_data["project"].id)

        data = {
            "start": self.day_ago.isoformat(),
            "end": (self.day_ago + timedelta(hours=2)).isoformat(),
            "interval": "1h",
            "yAxis": "count()",
            "orderby": ["-count()"],
            "field": ["count()", "group_id"],
            "topEvents": "5",
            "partial": "1",
        }
        with self.feature(self.enabled_features):
            response = self.client.get(self.url, data, format="json")
            assert response.status_code == 200, response.content
            assert response.data["the tag"]["data"][0][1] == [{"count": 7}]

        data["query"] = 'group_id:"the tag"'
        with self.feature(self.enabled_features):
            response = self.client.get(self.url, data, format="json")
            assert response.status_code == 200
            assert response.data["the tag"]["data"][0][1] == [{"count": 7}]

        data["query"] = "group_id:abc"
        with self.feature(self.enabled_features):
            response = self.client.get(self.url, data, format="json")
            assert response.status_code == 200
            assert all([interval[1][0]["count"] == 0 for interval in response.data["data"]])

    def test_top_events_limits(self):
        data = {
            "start": self.day_ago.isoformat(),
            "end": (self.day_ago + timedelta(hours=2)).isoformat(),
            "interval": "1h",
            "yAxis": "count()",
            "orderby": ["-count()"],
            "field": ["count()", "message", "user.email"],
        }
        with self.feature(self.enabled_features):
            data["topEvents"] = str(MAX_TOP_EVENTS + 1)
            response = self.client.get(self.url, data, format="json")
            assert response.status_code == 400

            data["topEvents"] = "0"
            response = self.client.get(self.url, data, format="json")
            assert response.status_code == 400

            data["topEvents"] = "a"
            response = self.client.get(self.url, data, format="json")
            assert response.status_code == 400

    @pytest.mark.xfail(
        reason="The response is wrong whenever we have a top events timeseries on project + any other field + aggregation"
    )
    def test_top_events_with_projects(self):
        with self.feature(self.enabled_features):
            response = self.client.get(
                self.url,
                data={
                    "start": self.day_ago.isoformat(),
                    "end": (self.day_ago + timedelta(hours=2)).isoformat(),
                    "interval": "1h",
                    "yAxis": "count()",
                    "orderby": ["-count()"],
                    "field": ["count()", "message", "project"],
                    "topEvents": "5",
                },
                format="json",
            )

        data = response.data

        assert response.status_code == 200, response.content
        assert len(data) == 6
        for index, event in enumerate(self.events[:5]):
            message = event.message or event.transaction
            results = data[",".join([message, event.project.slug])]
            assert results["order"] == index
            assert [{"count": self.event_data[index]["count"]}] in [
                attrs for time, attrs in results["data"]
            ]

        other = data["Other"]
        assert other["order"] == 5
        assert [{"count": 3}] in [attrs for _, attrs in other["data"]]

    def test_top_events_with_issue(self):
        # delete a group to make sure if this happens the value becomes unknown
        event_group = self.events[0].group
        event_group.delete()

        with self.feature(self.enabled_features):
            response = self.client.get(
                self.url,
                data={
                    "start": self.day_ago.isoformat(),
                    "end": (self.day_ago + timedelta(hours=2)).isoformat(),
                    "interval": "1h",
                    "yAxis": "count()",
                    "orderby": ["-count()"],
                    "field": ["count()", "message", "issue"],
                    "topEvents": "5",
                    "query": "!event.type:transaction",
                },
                format="json",
            )

        data = response.data

        assert response.status_code == 200, response.content
        assert len(data) == 6

        for index, event in enumerate(self.events[:4]):
            message = event.message
            # Because we deleted the group for event 0
            if index == 0 or event.group is None:
                issue = "unknown"
            else:
                issue = event.group.qualified_short_id

            results = data[",".join([issue, message])]
            assert results["order"] == index
            assert [{"count": self.event_data[index]["count"]}] in [
                attrs for time, attrs in results["data"]
            ]

        other = data["Other"]
        assert other["order"] == 5
        assert [{"count": 1}] in [attrs for _, attrs in other["data"]]

    def test_transactions_top_events_with_issue(self):
        # delete a group to make sure if this happens the value becomes unknown
        event_group = self.events[0].group
        event_group.delete()

        with self.feature(self.enabled_features):
            response = self.client.get(
                self.url,
                data={
                    "start": self.day_ago.isoformat(),
                    "end": (self.day_ago + timedelta(hours=2)).isoformat(),
                    "interval": "1h",
                    "yAxis": "count()",
                    "orderby": ["-count()"],
                    "field": ["count()", "message", "issue"],
                    "topEvents": "5",
                    "query": "!event.type:transaction",
                    "dataset": "transactions",
                },
                format="json",
            )

        assert response.status_code == 200, response.content
        # Just asserting that this doesn't fail, issue on transactions dataset doesn't mean anything

    def test_top_events_with_transaction_status(self):
        with self.feature(self.enabled_features):
            response = self.client.get(
                self.url,
                data={
                    "start": self.day_ago.isoformat(),
                    "end": (self.day_ago + timedelta(hours=2)).isoformat(),
                    "interval": "1h",
                    "yAxis": "count()",
                    "orderby": ["-count()"],
                    "field": ["count()", "transaction.status"],
                    "topEvents": "5",
                },
                format="json",
            )

        data = response.data

        assert response.status_code == 200, response.content
        assert len(data) == 1
        assert "ok" in data

    @mock.patch("sentry.models.GroupManager.get_issues_mapping")
    def test_top_events_with_unknown_issue(self, mock_issues_mapping):
        event = self.events[0]
        event_data = self.event_data[0]

        # ensure that the issue mapping returns None for the issue
        mock_issues_mapping.return_value = {event.group.id: None}

        with self.feature(self.enabled_features):
            response = self.client.get(
                self.url,
                data={
                    "start": self.day_ago.isoformat(),
                    "end": (self.day_ago + timedelta(hours=2)).isoformat(),
                    "interval": "1h",
                    "yAxis": "count()",
                    "orderby": ["-count()"],
                    "field": ["count()", "issue"],
                    "topEvents": "5",
                    # narrow the search to just one issue
                    "query": f"issue.id:{event.group.id}",
                },
                format="json",
            )
        assert response.status_code == 200, response.content

        data = response.data
        assert len(data) == 1
        results = data["unknown"]
        assert results["order"] == 0
        assert [{"count": event_data["count"]}] in [attrs for time, attrs in results["data"]]

    @mock.patch(
        "sentry.search.events.builder.base.raw_snql_query",
        side_effect=[{"data": [{"issue.id": 1}], "meta": []}, {"data": [], "meta": []}],
    )
    def test_top_events_with_issue_check_query_conditions(self, mock_query):
        """ "Intentionally separate from test_top_events_with_issue

        This is to test against a bug where the condition for issues wasn't included and we'd be missing data for
        the interval since we'd cap out the max rows. This was not caught by the previous test since the results
        would still be correct given the smaller interval & lack of data
        """
        with self.feature(self.enabled_features):
            self.client.get(
                self.url,
                data={
                    "start": self.day_ago.isoformat(),
                    "end": (self.day_ago + timedelta(hours=2)).isoformat(),
                    "interval": "1h",
                    "yAxis": "count()",
                    "orderby": ["-count()"],
                    "field": ["count()", "message", "issue"],
                    "topEvents": "5",
                    "query": "!event.type:transaction",
                },
                format="json",
            )

        assert (
            Condition(Function("coalesce", [Column("group_id"), 0], "issue.id"), Op.IN, [1])
            in mock_query.mock_calls[1].args[0].query.where
        )

    def test_top_events_with_functions(self):
        for dataset in ["transactions", "discover"]:
            with self.feature(self.enabled_features):
                response = self.client.get(
                    self.url,
                    data={
                        "start": self.day_ago.isoformat(),
                        "end": (self.day_ago + timedelta(hours=2)).isoformat(),
                        "interval": "1h",
                        "yAxis": "count()",
                        "orderby": ["-p99()"],
                        "field": ["transaction", "avg(transaction.duration)", "p99()"],
                        "topEvents": "5",
                        "dataset": dataset,
                    },
                    format="json",
                )

            data = response.data

            assert response.status_code == 200, response.content
            assert len(data) == 1

            results = data[self.transaction.transaction]
            assert results["order"] == 0
            assert [attrs for time, attrs in results["data"]] == [[{"count": 3}], [{"count": 0}]]

    def test_top_events_with_functions_on_different_transactions(self):
        """Transaction2 has less events, but takes longer so order should be self.transaction then transaction2"""
        transaction_data = load_data("transaction")
        transaction_data["start_timestamp"] = (self.day_ago + timedelta(minutes=2)).isoformat()
        transaction_data["timestamp"] = (self.day_ago + timedelta(minutes=6)).isoformat()
        transaction_data["transaction"] = "/foo_bar/"
        transaction2 = self.store_event(transaction_data, project_id=self.project.id)
        with self.feature(self.enabled_features):
            response = self.client.get(
                self.url,
                data={
                    "start": self.day_ago.isoformat(),
                    "end": (self.day_ago + timedelta(hours=2)).isoformat(),
                    "interval": "1h",
                    "yAxis": "count()",
                    "orderby": ["-p90()"],
                    "field": ["transaction", "avg(transaction.duration)", "p90()"],
                    "topEvents": "5",
                },
                format="json",
            )

        data = response.data

        assert response.status_code == 200, response.content
        assert len(data) == 2

        results = data[self.transaction.transaction]
        assert results["order"] == 1
        assert [attrs for time, attrs in results["data"]] == [[{"count": 3}], [{"count": 0}]]

        results = data[transaction2.transaction]
        assert results["order"] == 0
        assert [attrs for time, attrs in results["data"]] == [[{"count": 1}], [{"count": 0}]]

    def test_top_events_with_query(self):
        transaction_data = load_data("transaction")
        transaction_data["start_timestamp"] = (self.day_ago + timedelta(minutes=2)).isoformat()
        transaction_data["timestamp"] = (self.day_ago + timedelta(minutes=6)).isoformat()
        transaction_data["transaction"] = "/foo_bar/"
        self.store_event(transaction_data, project_id=self.project.id)
        with self.feature(self.enabled_features):
            response = self.client.get(
                self.url,
                data={
                    "start": self.day_ago.isoformat(),
                    "end": (self.day_ago + timedelta(hours=2)).isoformat(),
                    "interval": "1h",
                    "yAxis": "count()",
                    "orderby": ["-p99()"],
                    "query": "transaction:/foo_bar/",
                    "field": ["transaction", "avg(transaction.duration)", "p99()"],
                    "topEvents": "5",
                },
                format="json",
            )

        data = response.data

        assert response.status_code == 200, response.content
        assert len(data) == 1

        transaction2_data = data["/foo_bar/"]
        assert transaction2_data["order"] == 0
        assert [attrs for time, attrs in transaction2_data["data"]] == [
            [{"count": 1}],
            [{"count": 0}],
        ]

    def test_top_events_with_negated_condition(self):
        with self.feature(self.enabled_features):
            response = self.client.get(
                self.url,
                data={
                    "start": self.day_ago.isoformat(),
                    "end": (self.day_ago + timedelta(hours=2)).isoformat(),
                    "interval": "1h",
                    "yAxis": "count()",
                    "orderby": ["-count()"],
                    "query": f"!message:{self.events[0].message}",
                    "field": ["message", "count()"],
                    "topEvents": "5",
                },
                format="json",
            )

        data = response.data

        assert response.status_code == 200, response.content
        assert len(data) == 6

        for index, event in enumerate(self.events[1:5]):
            message = event.message or event.transaction
            results = data[message]
            assert results["order"] == index
            assert [{"count": self.event_data[index + 1]["count"]}] in [
                attrs for _, attrs in results["data"]
            ]

        other = data["Other"]
        assert other["order"] == 5
        assert [{"count": 1}] in [attrs for _, attrs in other["data"]]

    def test_top_events_with_epm(self):
        with self.feature(self.enabled_features):
            response = self.client.get(
                self.url,
                data={
                    "start": self.day_ago.isoformat(),
                    "end": (self.day_ago + timedelta(hours=2)).isoformat(),
                    "interval": "1h",
                    "yAxis": "epm()",
                    "orderby": ["-count()"],
                    "field": ["message", "user.email", "count()"],
                    "topEvents": "5",
                },
                format="json",
            )

        data = response.data
        assert response.status_code == 200, response.content
        assert len(data) == 6

        for index, event in enumerate(self.events[:5]):
            message = event.message or event.transaction
            results = data[
                ",".join([message, self.event_data[index]["data"]["user"].get("email", "None")])
            ]
            assert results["order"] == index
            assert [{"count": self.event_data[index]["count"] / (3600.0 / 60.0)}] in [
                attrs for time, attrs in results["data"]
            ]

        other = data["Other"]
        assert other["order"] == 5
        assert [{"count": 0.05}] in [attrs for _, attrs in other["data"]]

    def test_top_events_with_multiple_yaxis(self):
        with self.feature(self.enabled_features):
            response = self.client.get(
                self.url,
                data={
                    "start": self.day_ago.isoformat(),
                    "end": (self.day_ago + timedelta(hours=2)).isoformat(),
                    "interval": "1h",
                    "yAxis": ["epm()", "count()"],
                    "orderby": ["-count()"],
                    "field": ["message", "user.email", "count()"],
                    "topEvents": "5",
                },
                format="json",
            )

        data = response.data
        assert response.status_code == 200, response.content
        assert len(data) == 6

        for index, event in enumerate(self.events[:5]):
            message = event.message or event.transaction
            results = data[
                ",".join([message, self.event_data[index]["data"]["user"].get("email", "None")])
            ]
            assert results["order"] == index
            assert results["epm()"]["order"] == 0
            assert results["count()"]["order"] == 1
            assert [{"count": self.event_data[index]["count"] / (3600.0 / 60.0)}] in [
                attrs for time, attrs in results["epm()"]["data"]
            ]

            assert [{"count": self.event_data[index]["count"]}] in [
                attrs for time, attrs in results["count()"]["data"]
            ]

        other = data["Other"]
        assert other["order"] == 5
        assert other["epm()"]["order"] == 0
        assert other["count()"]["order"] == 1
        assert [{"count": 0.05}] in [attrs for _, attrs in other["epm()"]["data"]]
        assert [{"count": 3}] in [attrs for _, attrs in other["count()"]["data"]]

    def test_top_events_with_boolean(self):
        with self.feature(self.enabled_features):
            response = self.client.get(
                self.url,
                data={
                    "start": self.day_ago.isoformat(),
                    "end": (self.day_ago + timedelta(hours=2)).isoformat(),
                    "interval": "1h",
                    "yAxis": "count()",
                    "orderby": ["-count()"],
                    "field": ["count()", "message", "device.charging"],
                    "topEvents": "5",
                },
                format="json",
            )

        data = response.data
        assert response.status_code == 200, response.content
        assert len(data) == 6

        for index, event in enumerate(self.events[:5]):
            message = event.message or event.transaction
            results = data[",".join(["False", message])]
            assert results["order"] == index
            assert [{"count": self.event_data[index]["count"]}] in [
                attrs for time, attrs in results["data"]
            ]

        other = data["Other"]
        assert other["order"] == 5
        assert [{"count": 3}] in [attrs for _, attrs in other["data"]]

    def test_top_events_with_error_unhandled(self):
        self.login_as(user=self.user)
        project = self.create_project()
        prototype = load_data("android-ndk")
        prototype["event_id"] = "f" * 32
        prototype["logentry"] = {"formatted": "not handled"}
        prototype["exception"]["values"][0]["value"] = "not handled"
        prototype["exception"]["values"][0]["mechanism"]["handled"] = False
        prototype["timestamp"] = (self.day_ago + timedelta(minutes=2)).isoformat()
        self.store_event(data=prototype, project_id=project.id)

        with self.feature(self.enabled_features):
            response = self.client.get(
                self.url,
                data={
                    "start": self.day_ago.isoformat(),
                    "end": (self.day_ago + timedelta(hours=2)).isoformat(),
                    "interval": "1h",
                    "yAxis": "count()",
                    "orderby": ["-count()"],
                    "field": ["count()", "error.unhandled"],
                    "topEvents": "5",
                },
                format="json",
            )

        data = response.data
        assert response.status_code == 200, response.content
        assert len(data) == 2

    def test_top_events_with_timestamp(self):
        with self.feature(self.enabled_features):
            response = self.client.get(
                self.url,
                data={
                    "start": self.day_ago.isoformat(),
                    "end": (self.day_ago + timedelta(hours=2)).isoformat(),
                    "interval": "1h",
                    "yAxis": "count()",
                    "orderby": ["-count()"],
                    "query": "event.type:default",
                    "field": ["count()", "message", "timestamp"],
                    "topEvents": "5",
                },
                format="json",
            )

        data = response.data
        assert response.status_code == 200, response.content
        assert len(data) == 6
        # Transactions won't be in the results because of the query
        del self.events[4]
        del self.event_data[4]

        for index, event in enumerate(self.events[:5]):
            results = data[",".join([event.message, event.timestamp])]
            assert results["order"] == index
            assert [{"count": self.event_data[index]["count"]}] in [
                attrs for time, attrs in results["data"]
            ]

        other = data["Other"]
        assert other["order"] == 5
        assert [{"count": 1}] in [attrs for _, attrs in other["data"]]

    def test_top_events_with_int(self):
        with self.feature(self.enabled_features):
            response = self.client.get(
                self.url,
                data={
                    "start": self.day_ago.isoformat(),
                    "end": (self.day_ago + timedelta(hours=2)).isoformat(),
                    "interval": "1h",
                    "yAxis": "count()",
                    "orderby": ["-count()"],
                    "field": ["count()", "message", "transaction.duration"],
                    "topEvents": "5",
                },
                format="json",
            )

        data = response.data
        assert response.status_code == 200, response.content
        assert len(data) == 1

        results = data[",".join([self.transaction.transaction, "120000"])]
        assert results["order"] == 0
        assert [attrs for time, attrs in results["data"]] == [[{"count": 3}], [{"count": 0}]]

    def test_top_events_with_user(self):
        with self.feature(self.enabled_features):
            response = self.client.get(
                self.url,
                data={
                    "start": self.day_ago.isoformat(),
                    "end": (self.day_ago + timedelta(hours=2)).isoformat(),
                    "interval": "1h",
                    "yAxis": "count()",
                    "orderby": ["-count()", "user"],
                    "field": ["user", "count()"],
                    "topEvents": "5",
                },
                format="json",
            )

        data = response.data
        assert response.status_code == 200, response.content
        assert len(data) == 5

        assert data["email:bar@example.com"]["order"] == 1
        assert [attrs for time, attrs in data["email:bar@example.com"]["data"]] == [
            [{"count": 7}],
            [{"count": 0}],
        ]
        assert [attrs for time, attrs in data["ip:127.0.0.1"]["data"]] == [
            [{"count": 3}],
            [{"count": 0}],
        ]

    def test_top_events_with_user_and_email(self):
        with self.feature(self.enabled_features):
            response = self.client.get(
                self.url,
                data={
                    "start": self.day_ago.isoformat(),
                    "end": (self.day_ago + timedelta(hours=2)).isoformat(),
                    "interval": "1h",
                    "yAxis": "count()",
                    "orderby": ["-count()", "user"],
                    "field": ["user", "user.email", "count()"],
                    "topEvents": "5",
                },
                format="json",
            )

        data = response.data
        assert response.status_code == 200, response.content
        assert len(data) == 5

        assert data["email:bar@example.com,bar@example.com"]["order"] == 1
        assert [attrs for time, attrs in data["email:bar@example.com,bar@example.com"]["data"]] == [
            [{"count": 7}],
            [{"count": 0}],
        ]
        assert [attrs for time, attrs in data["ip:127.0.0.1,None"]["data"]] == [
            [{"count": 3}],
            [{"count": 0}],
        ]

    def test_top_events_with_user_display(self):
        with self.feature(self.enabled_features):
            response = self.client.get(
                self.url,
                data={
                    "start": self.day_ago.isoformat(),
                    "end": (self.day_ago + timedelta(hours=2)).isoformat(),
                    "interval": "1h",
                    "yAxis": "count()",
                    "orderby": ["-count()"],
                    "field": ["message", "user.display", "count()"],
                    "topEvents": "5",
                },
                format="json",
            )

        data = response.data
        assert response.status_code == 200, response.content
        assert len(data) == 6

        for index, event in enumerate(self.events[:5]):
            message = event.message or event.transaction
            user = self.event_data[index]["data"]["user"]
            results = data[
                ",".join([message, user.get("email", None) or user.get("ip_address", "None")])
            ]
            assert results["order"] == index
            assert [{"count": self.event_data[index]["count"]}] in [
                attrs for _, attrs in results["data"]
            ]

        other = data["Other"]
        assert other["order"] == 5
        assert [{"count": 3}] in [attrs for _, attrs in other["data"]]

    @pytest.mark.skip(reason="A query with group_id will not return transactions")
    def test_top_events_none_filter(self):
        """When a field is None in one of the top events, make sure we filter by it

        In this case event[4] is a transaction and has no issue
        """
        with self.feature(self.enabled_features):
            response = self.client.get(
                self.url,
                data={
                    "start": self.day_ago.isoformat(),
                    "end": (self.day_ago + timedelta(hours=2)).isoformat(),
                    "interval": "1h",
                    "yAxis": "count()",
                    "orderby": ["-count()"],
                    "field": ["count()", "issue"],
                    "topEvents": "5",
                },
                format="json",
            )

        data = response.data

        assert response.status_code == 200, response.content
        assert len(data) == 5

        for index, event in enumerate(self.events[:5]):
            if event.group is None:
                issue = "unknown"
            else:
                issue = event.group.qualified_short_id

            results = data[issue]
            assert results["order"] == index
            assert [{"count": self.event_data[index]["count"]}] in [
                attrs for time, attrs in results["data"]
            ]

    @pytest.mark.skip(reason="Invalid query - transaction events don't have group_id field")
    def test_top_events_one_field_with_none(self):
        with self.feature(self.enabled_features):
            response = self.client.get(
                self.url,
                data={
                    "start": self.day_ago.isoformat(),
                    "end": (self.day_ago + timedelta(hours=2)).isoformat(),
                    "interval": "1h",
                    "yAxis": "count()",
                    "orderby": ["-count()"],
                    "query": "event.type:transaction",
                    "field": ["count()", "issue"],
                    "topEvents": "5",
                },
                format="json",
            )

        data = response.data

        assert response.status_code == 200, response.content
        assert len(data) == 1

        results = data["unknown"]
        assert [attrs for time, attrs in results["data"]] == [[{"count": 3}], [{"count": 0}]]
        assert results["order"] == 0

    def test_top_events_with_error_handled(self):
        data = self.event_data[0]
        data["data"]["level"] = "error"
        data["data"]["exception"] = {
            "values": [
                {
                    "type": "ValidationError",
                    "value": "Bad request",
                    "mechanism": {"handled": True, "type": "generic"},
                }
            ]
        }
        self.store_event(data["data"], project_id=data["project"].id)
        data["data"]["exception"] = {
            "values": [
                {
                    "type": "ValidationError",
                    "value": "Bad request",
                    "mechanism": {"handled": False, "type": "generic"},
                }
            ]
        }
        self.store_event(data["data"], project_id=data["project"].id)
        with self.feature(self.enabled_features):
            response = self.client.get(
                self.url,
                data={
                    "start": self.day_ago.isoformat(),
                    "end": (self.day_ago + timedelta(hours=2)).isoformat(),
                    "interval": "1h",
                    "yAxis": "count()",
                    "orderby": ["-count()"],
                    "field": ["count()", "error.handled"],
                    "topEvents": "5",
                    "query": "!event.type:transaction",
                },
                format="json",
            )

        assert response.status_code == 200, response.content
        res_data = response.data

        assert len(res_data) == 2

        results = res_data["1"]
        assert [attrs for time, attrs in results["data"]] == [[{"count": 20}], [{"count": 6}]]

        results = res_data["0"]
        assert [attrs for time, attrs in results["data"]] == [[{"count": 1}], [{"count": 0}]]

    def test_top_events_with_aggregate_condition(self):
        with self.feature(self.enabled_features):
            response = self.client.get(
                self.url,
                data={
                    "start": self.day_ago.isoformat(),
                    "end": (self.day_ago + timedelta(hours=2)).isoformat(),
                    "interval": "1h",
                    "yAxis": "count()",
                    "orderby": ["-count()"],
                    "field": ["message", "count()"],
                    "query": "count():>4",
                    "topEvents": "5",
                },
                format="json",
            )

        assert response.status_code == 200, response.content
        data = response.data
        assert len(data) == 3

        for index, event in enumerate(self.events[:3]):
            message = event.message or event.transaction
            results = data[message]
            assert results["order"] == index
            assert [{"count": self.event_data[index]["count"]}] in [
                attrs for time, attrs in results["data"]
            ]

    @pytest.mark.xfail(reason="There's only 2 rows total, which mean there shouldn't be other")
    def test_top_events_with_to_other(self):
        version = "version -@'\" 1.2,3+(4)"
        version_escaped = "version -@'\\\" 1.2,3+(4)"
        # every symbol is replaced with a underscore to make the alias
        version_alias = "version_______1_2_3__4_"

        # add an event in the current release
        event = self.event_data[0]
        event_data = event["data"].copy()
        event_data["event_id"] = uuid4().hex
        event_data["release"] = version
        self.store_event(event_data, project_id=event["project"].id)

        with self.feature(self.enabled_features):
            response = self.client.get(
                self.url,
                data={
                    "start": self.day_ago.isoformat(),
                    "end": (self.day_ago + timedelta(hours=2)).isoformat(),
                    "interval": "1h",
                    "yAxis": "count()",
                    # the double underscores around the version alias is because of a comma and quote
                    "orderby": [f"-to_other_release__{version_alias}__others_current"],
                    "field": [
                        "count()",
                        f'to_other(release,"{version_escaped}",others,current)',
                    ],
                    "topEvents": "2",
                },
                format="json",
            )

        assert response.status_code == 200, response.content
        data = response.data
        assert len(data) == 2

        current = data["current"]
        assert current["order"] == 1
        assert sum(attrs[0]["count"] for _, attrs in current["data"]) == 1

        others = data["others"]
        assert others["order"] == 0
        assert sum(attrs[0]["count"] for _, attrs in others["data"]) == sum(
            event_data["count"] for event_data in self.event_data
        )

    def test_top_events_with_equations(self):
        with self.feature(self.enabled_features):
            response = self.client.get(
                self.url,
                data={
                    "start": self.day_ago.isoformat(),
                    "end": (self.day_ago + timedelta(hours=2)).isoformat(),
                    "interval": "1h",
                    "yAxis": "equation|count() / 100",
                    "orderby": ["-count()"],
                    "field": ["count()", "message", "user.email", "equation|count() / 100"],
                    "topEvents": "5",
                },
                format="json",
            )

        data = response.data
        assert response.status_code == 200, response.content
        assert len(data) == 6

        for index, event in enumerate(self.events[:5]):
            message = event.message or event.transaction
            results = data[
                ",".join([message, self.event_data[index]["data"]["user"].get("email", "None")])
            ]
            assert results["order"] == index
            assert [{"count": self.event_data[index]["count"] / 100}] in [
                attrs for time, attrs in results["data"]
            ]

        other = data["Other"]
        assert other["order"] == 5
        assert [{"count": 0.03}] in [attrs for _, attrs in other["data"]]

    @mock.patch("sentry.snuba.discover.bulk_snuba_queries", return_value=[{"data": [], "meta": []}])
    @mock.patch(
        "sentry.search.events.builder.base.raw_snql_query",
        return_value={"data": [], "meta": []},
    )
    def test_invalid_interval(self, mock_raw_query, mock_bulk_query):
        with self.feature(self.enabled_features):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "end": before_now().isoformat(),
                    # 7,200 points for each event
                    "start": before_now(seconds=7200).isoformat(),
                    "field": ["count()", "issue"],
                    "query": "",
                    "interval": "1s",
                    "yAxis": "count()",
                },
            )
        assert response.status_code == 200
        assert mock_bulk_query.call_count == 1

        with self.feature(self.enabled_features):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "end": before_now().isoformat(),
                    "start": before_now(seconds=7200).isoformat(),
                    "field": ["count()", "issue"],
                    "query": "",
                    "interval": "1s",
                    "yAxis": "count()",
                    # 7,200 points for each event * 2, should error
                    "topEvents": "2",
                },
            )
        assert response.status_code == 200
        assert mock_raw_query.call_count == 2
        # Should've reset to the default for between 1 and 24h
        assert mock_raw_query.mock_calls[1].args[0].query.granularity.granularity == 300

        with self.feature(self.enabled_features):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "end": before_now().isoformat(),
                    # 1999 points * 5 events should just be enough to not error
                    "start": before_now(seconds=1999).isoformat(),
                    "field": ["count()", "issue"],
                    "query": "",
                    "interval": "1s",
                    "yAxis": "count()",
                    "topEvents": "5",
                },
            )
        assert response.status_code == 200
        assert mock_raw_query.call_count == 4
        # Should've left the interval alone since we're just below the limit
        assert mock_raw_query.mock_calls[3].args[0].query.granularity.granularity == 1

        with self.feature(self.enabled_features):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "end": before_now().isoformat(),
                    "start": before_now(hours=24).isoformat(),
                    "field": ["count()", "issue"],
                    "query": "",
                    "interval": "0d",
                    "yAxis": "count()",
                    "topEvents": "5",
                },
            )
        assert response.status_code == 200
        assert mock_raw_query.call_count == 6
        # Should've default to 24h's default of 5m
        assert mock_raw_query.mock_calls[5].args[0].query.granularity.granularity == 300

    def test_top_events_timestamp_fields(self):
        with self.feature(self.enabled_features):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "start": self.day_ago.isoformat(),
                    "end": (self.day_ago + timedelta(hours=2)).isoformat(),
                    "interval": "1h",
                    "yAxis": "count()",
                    "orderby": ["-count()"],
                    "field": ["count()", "timestamp", "timestamp.to_hour", "timestamp.to_day"],
                    "topEvents": "5",
                },
            )
        assert response.status_code == 200
        data = response.data
        assert len(data) == 3

        # these are the timestamps corresponding to the events stored
        timestamps = [
            self.day_ago + timedelta(minutes=2),
            self.day_ago + timedelta(hours=1, minutes=2),
            self.day_ago + timedelta(minutes=4),
        ]
        timestamp_hours = [timestamp.replace(minute=0, second=0) for timestamp in timestamps]
        timestamp_days = [timestamp.replace(hour=0, minute=0, second=0) for timestamp in timestamps]

        for ts, ts_hr, ts_day in zip(timestamps, timestamp_hours, timestamp_days):
            key = f"{ts.isoformat()},{ts_day.isoformat()},{ts_hr.isoformat()}"
            count = sum(e["count"] for e in self.event_data if e["data"]["timestamp"] == ts)
            results = data[key]
            assert [{"count": count}] in [attrs for time, attrs in results["data"]]

    def test_top_events_other_with_matching_columns(self):
        with self.feature(self.enabled_features):
            response = self.client.get(
                self.url,
                data={
                    "start": self.day_ago.isoformat(),
                    "end": (self.day_ago + timedelta(hours=2)).isoformat(),
                    "interval": "1h",
                    "yAxis": "count()",
                    "orderby": ["-count()"],
                    "field": ["count()", "tags[shared-tag]", "message"],
                    "topEvents": "5",
                },
                format="json",
            )

        data = response.data
        assert response.status_code == 200, response.content
        assert len(data) == 6

        for index, event in enumerate(self.events[:5]):
            message = event.message or event.transaction
            results = data[",".join([message, "yup"])]
            assert results["order"] == index
            assert [{"count": self.event_data[index]["count"]}] in [
                attrs for _, attrs in results["data"]
            ]

        other = data["Other"]
        assert other["order"] == 5
        assert [{"count": 3}] in [attrs for _, attrs in other["data"]]

    def test_top_events_with_field_overlapping_other_key(self):
        transaction_data = load_data("transaction")
        transaction_data["start_timestamp"] = (self.day_ago + timedelta(minutes=2)).isoformat()
        transaction_data["timestamp"] = (self.day_ago + timedelta(minutes=6)).isoformat()
        transaction_data["transaction"] = OTHER_KEY
        for i in range(5):
            data = transaction_data.copy()
            data["event_id"] = "ab" + f"{i}" * 30
            data["contexts"]["trace"]["span_id"] = "ab" + f"{i}" * 14
            self.store_event(data, project_id=self.project.id)

        with self.feature(self.enabled_features):
            response = self.client.get(
                self.url,
                data={
                    "start": self.day_ago.isoformat(),
                    "end": (self.day_ago + timedelta(hours=2)).isoformat(),
                    "interval": "1h",
                    "yAxis": "count()",
                    "orderby": ["-count()"],
                    "field": ["count()", "message"],
                    "topEvents": "5",
                },
                format="json",
            )

        data = response.data
        assert response.status_code == 200, response.content
        assert len(data) == 6

        assert f"{OTHER_KEY} (message)" in data
        results = data[f"{OTHER_KEY} (message)"]
        assert [{"count": 5}] in [attrs for _, attrs in results["data"]]

        other = data["Other"]
        assert other["order"] == 5
        assert [{"count": 4}] in [attrs for _, attrs in other["data"]]

    def test_top_events_can_exclude_other_series(self):
        with self.feature(self.enabled_features):
            response = self.client.get(
                self.url,
                data={
                    "start": self.day_ago.isoformat(),
                    "end": (self.day_ago + timedelta(hours=2)).isoformat(),
                    "interval": "1h",
                    "yAxis": "count()",
                    "orderby": ["count()"],
                    "field": ["count()", "message"],
                    "topEvents": "5",
                    "excludeOther": "1",
                },
                format="json",
            )

        data = response.data
        assert response.status_code == 200, response.content
        assert len(data) == 5

        assert "Other" not in response.data

    @pytest.mark.xfail(reason="Started failing on ClickHouse 21.8")
    def test_top_events_with_equation_including_unselected_fields_passes_field_validation(self):
        with self.feature(self.enabled_features):
            response = self.client.get(
                self.url,
                data={
                    "start": self.day_ago.isoformat(),
                    "end": (self.day_ago + timedelta(hours=2)).isoformat(),
                    "interval": "1h",
                    "yAxis": "count()",
                    "orderby": ["-equation[0]"],
                    "field": ["count()", "message", "equation|count_unique(user) * 2"],
                    "topEvents": "5",
                },
                format="json",
            )

        data = response.data
        assert response.status_code == 200, response.content
        assert len(data) == 6

        other = data["Other"]
        assert other["order"] == 5
        assert [{"count": 4}] in [attrs for _, attrs in other["data"]]

    def test_top_events_boolean_condition_and_project_field(self):
        with self.feature(self.enabled_features):
            response = self.client.get(
                self.url,
                data={
                    "start": self.day_ago.isoformat(),
                    "end": (self.day_ago + timedelta(hours=2)).isoformat(),
                    "interval": "1h",
                    "yAxis": "count()",
                    "orderby": ["-count()"],
                    "field": ["project", "count()"],
                    "topEvents": "5",
                    "query": "event.type:transaction (transaction:*a OR transaction:b*)",
                },
                format="json",
            )

        assert response.status_code == 200


class OrganizationEventsStatsProfileFunctionDatasetEndpointTest(
    APITestCase, ProfilesSnubaTestCase, SearchIssueTestMixin
):
    endpoint = "sentry-api-0-organization-events-stats"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

        self.one_day_ago = before_now(days=1).replace(hour=10, minute=0, second=0, microsecond=0)
        self.two_days_ago = before_now(days=2).replace(hour=10, minute=0, second=0, microsecond=0)
        self.three_days_ago = before_now(days=3).replace(hour=10, minute=0, second=0, microsecond=0)

        self.project = self.create_project()

        self.url = reverse(
            "sentry-api-0-organization-events-stats",
            kwargs={"organization_id_or_slug": self.project.organization.slug},
        )

    def test_functions_dataset_simple(self):
        transaction_function = self.store_functions(
            [
                {
                    "self_times_ns": [100_000_000 for _ in range(100)],
                    "package": "foo",
                    "function": "bar",
                    "in_app": True,
                },
            ],
            project=self.project,
            timestamp=self.two_days_ago - timedelta(hours=12),
        )

        continuous_timestamp = self.two_days_ago + timedelta(hours=12)
        continuous_function = self.store_functions_chunk(
            [
                {
                    "self_times_ns": [200_000_000 for _ in range(100)],
                    "package": "bar",
                    "function": "bar",
                    "thread_id": "1",
                    "in_app": True,
                },
            ],
            project=self.project,
            timestamp=continuous_timestamp,
        )

        y_axes = [
            "cpm()",
            "p95(function.duration)",
            "all_examples()",
        ]

        data = {
            "dataset": "profileFunctions",
            "start": self.three_days_ago.isoformat(),
            "end": self.one_day_ago.isoformat(),
            "interval": "1d",
            "yAxis": y_axes,
        }

        response = self.client.get(self.url, data=data, format="json")
        assert response.status_code == 200, response.content

        assert sum(row[1][0]["count"] for row in response.data["cpm()"]["data"]) == pytest.approx(
            200 / ((self.one_day_ago - self.three_days_ago).total_seconds() / 60), rel=1e-3
        )
        assert any(
            row[1][0]["count"] > 0 for row in response.data["p95(function.duration)"]["data"]
        )

        examples = [row[1][0]["count"] for row in response.data["all_examples()"]["data"]]
        assert examples == [
            [
                {
                    "profile_id": transaction_function["transaction"]["contexts"]["profile"][
                        "profile_id"
                    ],
                },
            ],
            [
                {
                    "profiler_id": continuous_function["profiler_id"],
                    "thread_id": "1",
                    "start": continuous_timestamp.timestamp(),
                    "end": (continuous_timestamp + timedelta(microseconds=200_000)).timestamp(),
                },
            ],
        ]

        assert response.data["cpm()"]["meta"]["fields"] == {
            "cpm": "number",
            "time": "date",
        }

        assert response.data["cpm()"]["meta"]["units"] == {"cpm": None, "time": None}

        assert response.data["p95(function.duration)"]["meta"]["fields"] == {
            "p95_function_duration": "duration",
            "time": "date",
        }

        assert response.data["p95(function.duration)"]["meta"]["units"] == {
            "p95_function_duration": "nanosecond",
            "time": None,
        }

        assert response.data["all_examples()"]["meta"]["fields"] == {
            "all_examples": "string",
            "time": "date",
        }

        assert response.data["all_examples()"]["meta"]["units"] == {
            "all_examples": None,
            "time": None,
        }


class OrganizationEventsStatsTopNEventsProfileFunctionDatasetEndpointTest(
    APITestCase, ProfilesSnubaTestCase, SearchIssueTestMixin
):
    endpoint = "sentry-api-0-organization-events-stats"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

        self.one_day_ago = before_now(days=1).replace(hour=10, minute=0, second=0, microsecond=0)
        self.two_days_ago = before_now(days=2).replace(hour=10, minute=0, second=0, microsecond=0)
        self.three_days_ago = before_now(days=3).replace(hour=10, minute=0, second=0, microsecond=0)

        self.project = self.create_project()

        self.url = reverse(
            "sentry-api-0-organization-events-stats",
            kwargs={"organization_id_or_slug": self.project.organization.slug},
        )

    def test_functions_dataset_simple(self):
        self.store_functions(
            [
                {
                    "self_times_ns": [100 for _ in range(100)],
                    "package": "pkg",
                    "function": "foo",
                    "in_app": True,
                },
                {
                    "self_times_ns": [100 for _ in range(10)],
                    "package": "pkg",
                    "function": "bar",
                    "in_app": True,
                },
            ],
            project=self.project,
            timestamp=self.two_days_ago,
        )

        y_axes = [
            "cpm()",
            "p95(function.duration)",
            "all_examples()",
        ]

        data = {
            "dataset": "profileFunctions",
            "field": ["function", "count()"],
            "start": self.three_days_ago.isoformat(),
            "end": self.one_day_ago.isoformat(),
            "yAxis": y_axes,
            "interval": "1d",
            "topEvents": "2",
            "excludeOther": "1",
        }

        response = self.client.get(self.url, data=data, format="json")
        assert response.status_code == 200, response.content
        assert sum(
            row[1][0]["count"] for row in response.data["foo"]["cpm()"]["data"]
        ) == pytest.approx(
            100 / ((self.one_day_ago - self.three_days_ago).total_seconds() / 60), rel=1e-3
        )
        assert sum(
            row[1][0]["count"] for row in response.data["bar"]["cpm()"]["data"]
        ) == pytest.approx(
            10 / ((self.one_day_ago - self.three_days_ago).total_seconds() / 60), rel=1e-3
        )

        assert any(
            row[1][0]["count"] > 0 for row in response.data["foo"]["p95(function.duration)"]["data"]
        )
        assert any(
            row[1][0]["count"] > 0 for row in response.data["bar"]["p95(function.duration)"]["data"]
        )

        for func in ["foo", "bar"]:
            for y_axis in y_axes:
                assert response.data[func]["p95(function.duration)"]["meta"]["fields"] == {
                    "time": "date",
                    "p95_function_duration": "duration",
                }
                assert response.data[func]["p95(function.duration)"]["meta"]["units"] == {
                    "time": None,
                    "p95_function_duration": "nanosecond",
                }

                assert response.data[func]["all_examples()"]["meta"]["fields"] == {
                    "time": "date",
                    "all_examples": "string",
                }
                assert response.data[func]["all_examples()"]["meta"]["units"] == {
                    "time": None,
                    "all_examples": None,
                }

                assert response.data[func]["cpm()"]["meta"]["fields"] == {
                    "time": "date",
                    "cpm": "number",
                }
                assert response.data[func]["cpm()"]["meta"]["units"] == {
                    "time": None,
                    "cpm": None,
                }


class OrganizationEventsStatsTopNEventsErrors(APITestCase, SnubaTestCase):
    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

        self.day_ago = before_now(days=1).replace(hour=10, minute=0, second=0, microsecond=0)

        self.project = self.create_project()
        self.project2 = self.create_project()
        self.user2 = self.create_user()
        self.event_data: list[_EventDataDict] = [
            {
                "data": {
                    "message": "poof",
                    "timestamp": (self.day_ago + timedelta(minutes=2)).isoformat(),
                    "user": {"email": self.user.email},
                    "tags": {"shared-tag": "yup"},
                    "fingerprint": ["group1"],
                },
                "project": self.project2,
                "count": 7,
            },
            {
                "data": {
                    "message": "voof",
                    "timestamp": (self.day_ago + timedelta(hours=1, minutes=2)).isoformat(),
                    "fingerprint": ["group2"],
                    "user": {"email": self.user2.email},
                    "tags": {"shared-tag": "yup"},
                },
                "project": self.project2,
                "count": 6,
            },
            {
                "data": {
                    "message": "very bad",
                    "timestamp": (self.day_ago + timedelta(minutes=2)).isoformat(),
                    "fingerprint": ["group3"],
                    "user": {"email": "foo@example.com"},
                    "tags": {"shared-tag": "yup"},
                },
                "project": self.project,
                "count": 5,
            },
            {
                "data": {
                    "message": "oh no",
                    "timestamp": (self.day_ago + timedelta(minutes=2)).isoformat(),
                    "fingerprint": ["group4"],
                    "user": {"email": "bar@example.com"},
                    "tags": {"shared-tag": "yup"},
                },
                "project": self.project,
                "count": 4,
            },
            {
                "data": {
                    "message": "kinda bad",
                    "timestamp": (self.day_ago + timedelta(minutes=2)).isoformat(),
                    "user": {"email": self.user.email},
                    "tags": {"shared-tag": "yup"},
                    "fingerprint": ["group7"],
                },
                "project": self.project,
                "count": 3,
            },
            # Not in the top 5
            {
                "data": {
                    "message": "sorta bad",
                    "timestamp": (self.day_ago + timedelta(minutes=2)).isoformat(),
                    "fingerprint": ["group5"],
                    "user": {"email": "bar@example.com"},
                    "tags": {"shared-tag": "yup"},
                },
                "project": self.project,
                "count": 2,
            },
            {
                "data": {
                    "message": "not so bad",
                    "timestamp": (self.day_ago + timedelta(minutes=2)).isoformat(),
                    "fingerprint": ["group6"],
                    "user": {"email": "bar@example.com"},
                    "tags": {"shared-tag": "yup"},
                },
                "project": self.project,
                "count": 1,
            },
        ]

        self.events = []
        for index, event_data in enumerate(self.event_data):
            data = event_data["data"].copy()
            for i in range(event_data["count"]):
                data["event_id"] = f"{index}{i}" * 16
                event = self.store_event(data, project_id=event_data["project"].id)
            self.events.append(event)

        self.enabled_features = {
            "organizations:discover-basic": True,
        }
        self.url = reverse(
            "sentry-api-0-organization-events-stats",
            kwargs={"organization_id_or_slug": self.project.organization.slug},
        )

    def test_simple_top_events(self):
        with self.feature(self.enabled_features):
            response = self.client.get(
                self.url,
                data={
                    "start": self.day_ago.isoformat(),
                    "end": (self.day_ago + timedelta(hours=2)).isoformat(),
                    "interval": "1h",
                    "yAxis": "count()",
                    "orderby": ["-count()"],
                    "field": ["count()", "message", "user.email"],
                    "dataset": "errors",
                    "topEvents": "5",
                },
                format="json",
            )

        data = response.data
        assert response.status_code == 200, response.content
        assert len(data) == 6

        for index, event in enumerate(self.events[:5]):
            message = event.message or event.transaction
            results = data[
                ",".join([message, self.event_data[index]["data"]["user"].get("email", "None")])
            ]
            assert results["order"] == index
            assert [{"count": self.event_data[index]["count"]}] in [
                attrs for _, attrs in results["data"]
            ]

        other = data["Other"]
        assert other["order"] == 5
        assert [{"count": 3}] in [attrs for _, attrs in other["data"]]

    def test_top_events_with_projects_other(self):
        with self.feature(self.enabled_features):
            response = self.client.get(
                self.url,
                data={
                    "start": self.day_ago.isoformat(),
                    "end": (self.day_ago + timedelta(hours=2)).isoformat(),
                    "interval": "1h",
                    "yAxis": "count()",
                    "orderby": ["-count()"],
                    "field": ["count()", "project"],
                    "dataset": "errors",
                    "topEvents": "1",
                },
                format="json",
            )

        data = response.data
        assert response.status_code == 200, response.content
        assert set(data.keys()) == {"Other", self.project.slug}

        assert data[self.project.slug]["order"] == 0
        assert [attrs[0]["count"] for _, attrs in data[self.project.slug]["data"]] == [15, 0]

        assert data["Other"]["order"] == 1
        assert [attrs[0]["count"] for _, attrs in data["Other"]["data"]] == [7, 6]

    def test_top_events_with_issue(self):
        # delete a group to make sure if this happens the value becomes unknown
        event_group = self.events[0].group
        event_group.delete()

        with self.feature(self.enabled_features):
            response = self.client.get(
                self.url,
                data={
                    "start": self.day_ago.isoformat(),
                    "end": (self.day_ago + timedelta(hours=2)).isoformat(),
                    "interval": "1h",
                    "yAxis": "count()",
                    "orderby": ["-count()"],
                    "field": ["count()", "message", "issue"],
                    "topEvents": "5",
                    "query": "",
                    "dataset": "errors",
                },
                format="json",
            )

        data = response.data

        assert response.status_code == 200, response.content
        assert len(data) == 6

        for index, event in enumerate(self.events[:4]):
            message = event.message
            # Because we deleted the group for event 0
            if index == 0 or event.group is None:
                issue = "unknown"
            else:
                issue = event.group.qualified_short_id

            results = data[",".join([issue, message])]
            assert results["order"] == index
            assert [{"count": self.event_data[index]["count"]}] in [
                attrs for time, attrs in results["data"]
            ]

        other = data["Other"]
        assert other["order"] == 5
        assert [attrs[0]["count"] for _, attrs in data["Other"]["data"]] == [3, 0]

    @mock.patch("sentry.models.GroupManager.get_issues_mapping")
    def test_top_events_with_unknown_issue(self, mock_issues_mapping):
        event = self.events[0]
        event_data = self.event_data[0]

        # ensure that the issue mapping returns None for the issue
        mock_issues_mapping.return_value = {event.group.id: None}

        with self.feature(self.enabled_features):
            response = self.client.get(
                self.url,
                data={
                    "start": self.day_ago.isoformat(),
                    "end": (self.day_ago + timedelta(hours=2)).isoformat(),
                    "interval": "1h",
                    "yAxis": "count()",
                    "orderby": ["-count()"],
                    "field": ["count()", "issue"],
                    "topEvents": "5",
                    # narrow the search to just one issue
                    "query": f"issue.id:{event.group.id}",
                    "dataset": "errors",
                },
                format="json",
            )
        assert response.status_code == 200, response.content

        data = response.data
        assert len(data) == 1
        results = data["unknown"]
        assert results["order"] == 0
        assert [{"count": event_data["count"]}] in [attrs for time, attrs in results["data"]]

    @mock.patch(
        "sentry.search.events.builder.base.raw_snql_query",
        side_effect=[{"data": [{"issue.id": 1}], "meta": []}, {"data": [], "meta": []}],
    )
    def test_top_events_with_issue_check_query_conditions(self, mock_query):
        """ "Intentionally separate from test_top_events_with_issue

        This is to test against a bug where the condition for issues wasn't included and we'd be missing data for
        the interval since we'd cap out the max rows. This was not caught by the previous test since the results
        would still be correct given the smaller interval & lack of data
        """
        with self.feature(self.enabled_features):
            self.client.get(
                self.url,
                data={
                    "start": self.day_ago.isoformat(),
                    "end": (self.day_ago + timedelta(hours=2)).isoformat(),
                    "interval": "1h",
                    "yAxis": "count()",
                    "orderby": ["-count()"],
                    "field": ["count()", "message", "issue"],
                    "topEvents": "5",
                    "query": "!event.type:transaction",
                    "dataset": "errors",
                },
                format="json",
            )

        assert (
            Condition(
                Function(
                    "coalesce",
                    [Column("group_id", entity=Entity("events", alias="events")), 0],
                    "issue.id",
                ),
                Op.IN,
                [1],
            )
            in mock_query.mock_calls[1].args[0].query.where
        )

    def test_group_id_tag_simple(self):
        event_data: _EventDataDict = {
            "data": {
                "message": "poof",
                "timestamp": (self.day_ago + timedelta(minutes=2)).isoformat(),
                "user": {"email": self.user.email},
                "tags": {"group_id": "the tag"},
                "fingerprint": ["group1"],
            },
            "project": self.project2,
            "count": 7,
        }
        for i in range(event_data["count"]):
            event_data["data"]["event_id"] = f"a{i}" * 16
            self.store_event(event_data["data"], project_id=event_data["project"].id)

        data = {
            "start": self.day_ago.isoformat(),
            "end": (self.day_ago + timedelta(hours=2)).isoformat(),
            "interval": "1h",
            "yAxis": "count()",
            "orderby": ["-count()"],
            "field": ["count()", "group_id"],
            "topEvents": "5",
            "partial": "1",
        }
        with self.feature(self.enabled_features):
            response = self.client.get(self.url, data, format="json")
            assert response.status_code == 200, response.content
            assert response.data["the tag"]["data"][0][1] == [{"count": 7}]

        data["query"] = 'group_id:"the tag"'
        with self.feature(self.enabled_features):
            response = self.client.get(self.url, data, format="json")
            assert response.status_code == 200
            assert response.data["the tag"]["data"][0][1] == [{"count": 7}]

        data["query"] = "group_id:abc"
        with self.feature(self.enabled_features):
            response = self.client.get(self.url, data, format="json")
            assert response.status_code == 200
            assert all([interval[1][0]["count"] == 0 for interval in response.data["data"]])

    def test_top_events_with_error_unhandled(self):
        self.login_as(user=self.user)
        project = self.create_project()
        prototype = load_data("android-ndk")
        prototype["event_id"] = "f" * 32
        prototype["logentry"] = {"formatted": "not handled"}
        prototype["exception"]["values"][0]["value"] = "not handled"
        prototype["exception"]["values"][0]["mechanism"]["handled"] = False
        prototype["timestamp"] = (self.day_ago + timedelta(minutes=2)).isoformat()
        self.store_event(data=prototype, project_id=project.id)

        with self.feature(self.enabled_features):
            response = self.client.get(
                self.url,
                data={
                    "start": self.day_ago.isoformat(),
                    "end": (self.day_ago + timedelta(hours=2)).isoformat(),
                    "interval": "1h",
                    "yAxis": "count()",
                    "orderby": ["-count()"],
                    "field": ["count()", "error.unhandled"],
                    "topEvents": "5",
                },
                format="json",
            )

        data = response.data
        assert response.status_code == 200, response.content
        assert len(data) == 2
