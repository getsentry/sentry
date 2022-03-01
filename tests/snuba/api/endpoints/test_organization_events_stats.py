import uuid
from datetime import timedelta
from unittest import mock
from uuid import uuid4

import pytest
from dateutil.parser import parse as parse_date
from django.urls import reverse
from pytz import utc
from snuba_sdk.column import Column
from snuba_sdk.conditions import Condition, Op
from snuba_sdk.function import Function

from sentry.constants import MAX_TOP_EVENTS
from sentry.models.transaction_threshold import ProjectTransactionThreshold, TransactionMetric
from sentry.snuba.discover import OTHER_KEY
from sentry.testutils import APITestCase, MetricsEnhancedPerformanceTestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.utils.samples import load_data


class OrganizationEventsStatsEndpointTest(APITestCase, SnubaTestCase):
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
                "timestamp": iso_format(self.day_ago + timedelta(minutes=1)),
                "fingerprint": ["group1"],
                "tags": {"sentry:user": self.user.email},
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "event_id": "b" * 32,
                "message": "oh my",
                "timestamp": iso_format(self.day_ago + timedelta(hours=1, minutes=1)),
                "fingerprint": ["group2"],
                "tags": {"sentry:user": self.user2.email},
            },
            project_id=self.project2.id,
        )
        self.store_event(
            data={
                "event_id": "c" * 32,
                "message": "very bad",
                "timestamp": iso_format(self.day_ago + timedelta(hours=1, minutes=2)),
                "fingerprint": ["group2"],
                "tags": {"sentry:user": self.user2.email},
            },
            project_id=self.project2.id,
        )
        self.url = reverse(
            "sentry-api-0-organization-events-stats",
            kwargs={"organization_slug": self.project.organization.slug},
        )
        self.features = {}

    def do_request(self, data, url=None, features=None):
        if features is None:
            features = {"organizations:discover-basic": True}
        features.update(self.features)
        with self.feature(features):
            return self.client.get(self.url if url is None else url, data=data, format="json")

    def test_simple(self):
        response = self.do_request(
            {
                "start": iso_format(self.day_ago),
                "end": iso_format(self.day_ago + timedelta(hours=2)),
                "interval": "1h",
            },
        )

        assert response.status_code == 200, response.content
        assert [attrs for time, attrs in response.data["data"]] == [[{"count": 1}], [{"count": 2}]]

    def test_misaligned_last_bucket(self):
        response = self.do_request(
            data={
                "start": iso_format(self.day_ago - timedelta(minutes=30)),
                "end": iso_format(self.day_ago + timedelta(hours=1, minutes=30)),
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
            "sentry-api-0-organization-events-stats", kwargs={"organization_slug": org.slug}
        )
        response = self.do_request({}, url)

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 0

    def test_user_count(self):
        self.store_event(
            data={
                "event_id": "d" * 32,
                "message": "something",
                "timestamp": iso_format(self.day_ago + timedelta(minutes=2)),
                "tags": {"sentry:user": self.user2.email},
                "fingerprint": ["group2"],
            },
            project_id=self.project2.id,
        )
        response = self.do_request(
            data={
                "start": iso_format(self.day_ago),
                "end": iso_format(self.day_ago + timedelta(hours=2)),
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
                "start": iso_format(self.day_ago),
                "end": iso_format(self.day_ago + timedelta(hours=2)),
                "interval": "1h",
                "yAxis": "user_count",
            },
        )
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) > 0

        response = self.do_request(
            data={
                "project": self.project.id,
                "start": iso_format(self.day_ago),
                "end": iso_format(self.day_ago + timedelta(hours=2)),
                "interval": "1h",
                "yAxis": "event_count",
            },
        )
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) > 0

    def test_with_event_count_flag(self):
        response = self.do_request(
            data={
                "start": iso_format(self.day_ago),
                "end": iso_format(self.day_ago + timedelta(hours=2)),
                "interval": "1h",
                "yAxis": "event_count",
            },
        )

        assert response.status_code == 200, response.content
        assert [attrs for time, attrs in response.data["data"]] == [[{"count": 1}], [{"count": 2}]]

    def test_performance_view_feature(self):
        response = self.do_request(
            data={
                "end": iso_format(before_now()),
                "start": iso_format(before_now(hours=2)),
                "query": "project_id:1",
                "interval": "30m",
                "yAxis": "count()",
            },
            features={
                "organizations:performance-view": True,
                "organizations:discover-basic": False,
            },
        )
        assert response.status_code == 200

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
                "start": iso_format(self.day_ago),
                "end": iso_format(self.day_ago + timedelta(hours=2)),
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
                "start": iso_format(self.day_ago),
                "end": iso_format(self.day_ago + timedelta(hours=2)),
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
                "start": iso_format(self.day_ago),
                "end": iso_format(self.day_ago + timedelta(hours=2)),
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
                "start": iso_format(self.day_ago),
                "end": iso_format(self.day_ago + timedelta(hours=2)),
                "interval": "1h",
                "yAxis": "count()",
            },
        )
        assert response.status_code == 200, response.content
        assert [attrs for time, attrs in response.data["data"]] == [[{"count": 1}], [{"count": 2}]]

    def test_invalid_aggregate(self):
        response = self.do_request(
            data={
                "start": iso_format(self.day_ago),
                "end": iso_format(self.day_ago + timedelta(hours=2)),
                "interval": "1h",
                "yAxis": "rubbish",
            },
        )
        assert response.status_code == 400, response.content

    def test_aggregate_function_user_count(self):
        response = self.do_request(
            data={
                "start": iso_format(self.day_ago),
                "end": iso_format(self.day_ago + timedelta(hours=2)),
                "interval": "1h",
                "yAxis": "count_unique(user)",
            },
        )
        assert response.status_code == 200, response.content
        assert [attrs for time, attrs in response.data["data"]] == [[{"count": 1}], [{"count": 1}]]

    def test_aggregate_invalid(self):
        response = self.do_request(
            data={
                "start": iso_format(self.day_ago),
                "end": iso_format(self.day_ago + timedelta(hours=2)),
                "interval": "1h",
                "yAxis": "nope(lol)",
            },
        )
        assert response.status_code == 400, response.content

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
                        "timestamp": iso_format(
                            self.day_ago + timedelta(hours=hour, minutes=minute)
                        ),
                        "fingerprint": ["group1"],
                        "tags": {"sentry:user": self.user.email},
                    },
                    project_id=project.id,
                )

        for axis in ["epm()", "tpm()"]:
            response = self.do_request(
                data={
                    "start": iso_format(self.day_ago),
                    "end": iso_format(self.day_ago + timedelta(hours=6)),
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
                        "timestamp": iso_format(
                            self.day_ago + timedelta(hours=hour, minutes=minute)
                        ),
                        "fingerprint": ["group1"],
                        "tags": {"sentry:user": self.user.email},
                    },
                    project_id=project.id,
                )

        for axis in ["epm()", "tpm()"]:
            response = self.do_request(
                data={
                    "start": iso_format(self.day_ago),
                    "end": iso_format(self.day_ago + timedelta(hours=24)),
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
                        "timestamp": iso_format(
                            self.day_ago + timedelta(minutes=minute, seconds=second)
                        ),
                        "fingerprint": ["group1"],
                        "tags": {"sentry:user": self.user.email},
                    },
                    project_id=project.id,
                )

        for axis in ["eps()", "tps()"]:
            response = self.do_request(
                data={
                    "start": iso_format(self.day_ago),
                    "end": iso_format(self.day_ago + timedelta(minutes=6)),
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
                        "timestamp": iso_format(
                            self.day_ago + timedelta(minutes=minute, seconds=second)
                        ),
                        "fingerprint": ["group1"],
                        "tags": {"sentry:user": self.user.email},
                    },
                    project_id=project.id,
                )

        response = self.do_request(
            data={
                "start": iso_format(self.day_ago),
                "end": iso_format(self.day_ago + timedelta(minutes=1)),
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
            data["timestamp"] = iso_format(fixture[1])
            data["start_timestamp"] = iso_format(fixture[1] - timedelta(seconds=1))
            self.store_event(data=data, project_id=self.project.id)

        response = self.do_request(
            data={
                "project": self.project.id,
                "end": iso_format(before_now()),
                "start": iso_format(before_now(hours=2)),
                "query": "event.type:transaction",
                "interval": "30m",
                "yAxis": "count()",
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
                "end": iso_format(before_now()),
                "start": iso_format(before_now(hours=2)),
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
                "end": iso_format(before_now()),
                "start": iso_format(before_now(hours=2)),
                "query": "release:latest",
                "interval": "30m",
                "yAxis": "count()",
            },
        )
        assert response.status_code == 200

    def test_conditional_filter(self):
        response = self.do_request(
            data={
                "start": iso_format(self.day_ago),
                "end": iso_format(self.day_ago + timedelta(hours=2)),
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
                "start": iso_format(self.day_ago),
                "end": iso_format(self.day_ago + timedelta(hours=2)),
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
                "start": iso_format(self.day_ago),
                "end": iso_format(self.day_ago + timedelta(hours=2)),
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

    def test_equation_mixed_multi_yaxis(self):
        response = self.do_request(
            data={
                "start": iso_format(self.day_ago),
                "end": iso_format(self.day_ago + timedelta(hours=2)),
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
                "start": iso_format(self.day_ago),
                "end": iso_format(self.day_ago + timedelta(hours=2)),
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
                "timestamp": iso_format(self.day_ago - timedelta(minutes=10)),
                "fingerprint": ["group3"],
            },
            project_id=self.project.id,
        )

        response = self.do_request(
            data={
                "project": self.project.id,
                "end": iso_format(self.day_ago),
                "start": iso_format(self.day_ago - timedelta(hours=24)),
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
                "start": iso_format(self.day_ago),
                "end": iso_format(self.day_ago + timedelta(hours=2)),
                "interval": "1h",
                "yAxis": ["user_count", "event_count", "epm()", "eps()"],
            },
        )

        assert mock_query.call_count == 1

    @mock.patch("sentry.snuba.discover.bulk_raw_query", return_value=[{"data": []}])
    def test_invalid_interval(self, mock_query):
        self.do_request(
            data={
                "end": iso_format(before_now()),
                "start": iso_format(before_now(hours=24)),
                "query": "",
                "interval": "1s",
                "yAxis": "count()",
            },
        )
        assert mock_query.call_count == 1
        # Should've reset to the default for 24h
        assert mock_query.mock_calls[0].args[0][0].rollup == 300

        self.do_request(
            data={
                "end": iso_format(before_now()),
                "start": iso_format(before_now(hours=24)),
                "query": "",
                "interval": "0d",
                "yAxis": "count()",
            },
        )
        assert mock_query.call_count == 2
        # Should've reset to the default for 24h
        assert mock_query.mock_calls[0].args[0][0].rollup == 300

    def test_out_of_retention(self):
        with self.options({"system.event-retention-days": 10}):
            response = self.do_request(
                data={
                    "start": iso_format(before_now(days=20)),
                    "end": iso_format(before_now(days=15)),
                    "query": "",
                    "interval": "30m",
                    "yAxis": "count()",
                },
            )
        assert response.status_code == 400

    @mock.patch("sentry.utils.snuba.quantize_time")
    def test_quantize_dates(self, mock_quantize):
        mock_quantize.return_value = before_now(days=1).replace(tzinfo=utc)
        # Don't quantize short time periods
        self.do_request(
            data={"statsPeriod": "1h", "query": "", "interval": "30m", "yAxis": "count()"},
        )
        # Don't quantize absolute date periods
        self.do_request(
            data={
                "start": iso_format(before_now(days=20)),
                "end": iso_format(before_now(days=15)),
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
                "start": iso_format(self.day_ago),
                "end": iso_format(self.day_ago + timedelta(hours=2)),
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
        start = iso_format(self.day_ago)
        end = iso_format(self.day_ago + timedelta(hours=2))
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

    def test_comparison(self):
        self.store_event(
            data={
                "timestamp": iso_format(self.day_ago + timedelta(days=-1, minutes=1)),
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "timestamp": iso_format(self.day_ago + timedelta(days=-1, minutes=2)),
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "timestamp": iso_format(self.day_ago + timedelta(days=-1, hours=1, minutes=1)),
            },
            project_id=self.project2.id,
        )

        response = self.do_request(
            data={
                "start": iso_format(self.day_ago),
                "end": iso_format(self.day_ago + timedelta(hours=2)),
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
                "start": iso_format(self.day_ago),
                "end": iso_format(self.day_ago + timedelta(hours=2)),
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
                    "start": iso_format(start),
                    "end": iso_format(end),
                    "interval": "1h",
                    "comparisonDelta": int(timedelta(days=7).total_seconds()),
                }
            )
            assert response.status_code == 400, response.content
            assert response.data["detail"] == "Comparison period is outside retention window"


class OrganizationEventsStatsEndpointTestWithSnql(OrganizationEventsStatsEndpointTest):
    def setUp(self):
        super().setUp()
        self.features["organizations:discover-use-snql"] = True

    # Separate test for now to keep the patching simpler
    @mock.patch("sentry.snuba.discover.bulk_snql_query", return_value=[{"data": []}])
    def test_invalid_interval(self, mock_query):
        self.do_request(
            data={
                "end": iso_format(before_now()),
                "start": iso_format(before_now(hours=24)),
                "query": "",
                "interval": "1s",
                "yAxis": "count()",
            },
        )
        assert mock_query.call_count == 1
        # Should've reset to the default for 24h
        assert mock_query.mock_calls[0].args[0][0].granularity.granularity == 300

        self.do_request(
            data={
                "end": iso_format(before_now()),
                "start": iso_format(before_now(hours=24)),
                "query": "",
                "interval": "0d",
                "yAxis": "count()",
            },
        )
        assert mock_query.call_count == 2
        # Should've reset to the default for 24h
        assert mock_query.mock_calls[1].args[0][0].granularity.granularity == 300

    def test_equations_divide_by_zero(self):
        response = self.do_request(
            data={
                "start": iso_format(self.day_ago),
                "end": iso_format(self.day_ago + timedelta(hours=2)),
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


class OrganizationEventsStatsMetricsEnhancedPerformanceEndpointTest(
    MetricsEnhancedPerformanceTestCase
):
    endpoint = "sentry-api-0-organization-events-stats"
    METRIC_STRINGS = ["foo_transaction"]

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.day_ago = before_now(days=1).replace(hour=10, minute=0, second=0, microsecond=0)
        self.DEFAULT_METRIC_TIMESTAMP = self.day_ago

        self.url = reverse(
            "sentry-api-0-organization-events-stats",
            kwargs={"organization_slug": self.project.organization.slug},
        )
        self.features = {
            "organizations:performance-use-metrics": True,
            "organizations:discover-use-snql": True,
        }
        # referrer is used so we know when we can enable MEP or not
        self.referrer = "api.performance.homepage.widget-chart"

    def do_request(self, data, url=None, features=None):
        if features is None:
            features = {"organizations:discover-basic": True}
        features.update(self.features)
        with self.feature(features):
            return self.client.get(self.url if url is None else url, data=data, format="json")

    # These throughput tests should roughly match the ones in OrganizationEventsStatsEndpointTest
    def test_throughput_epm_hour_rollup(self):
        # Each of these denotes how many events to create in each hour
        event_counts = [6, 0, 6, 3, 0, 3]
        for hour, count in enumerate(event_counts):
            for minute in range(count):
                self.store_metric(1, timestamp=self.day_ago + timedelta(hours=hour, minutes=minute))

        for axis in ["epm()", "tpm()"]:
            response = self.do_request(
                data={
                    "start": iso_format(self.day_ago),
                    "end": iso_format(self.day_ago + timedelta(hours=6)),
                    "interval": "1h",
                    "yAxis": axis,
                    "project": self.project.id,
                    "referrer": self.referrer,
                },
            )
            assert response.status_code == 200, response.content
            data = response.data["data"]
            assert len(data) == 6
            assert response.data["isMetricsData"]

            rows = data[0:6]
            for test in zip(event_counts, rows):
                assert test[1][1][0]["count"] == test[0] / (3600.0 / 60.0)

    def test_throughput_epm_day_rollup(self):
        # Each of these denotes how many events to create in each minute
        event_counts = [6, 0, 6, 3, 0, 3]
        for hour, count in enumerate(event_counts):
            for minute in range(count):
                self.store_metric(1, timestamp=self.day_ago + timedelta(hours=hour, minutes=minute))

        for axis in ["epm()", "tpm()"]:
            response = self.do_request(
                data={
                    "start": iso_format(self.day_ago),
                    "end": iso_format(self.day_ago + timedelta(hours=24)),
                    "interval": "24h",
                    "yAxis": axis,
                    "project": self.project.id,
                    "referrer": self.referrer,
                },
            )
            assert response.status_code == 200, response.content
            data = response.data["data"]
            assert len(data) == 2
            assert response.data["isMetricsData"]

            assert data[0][1][0]["count"] == sum(event_counts) / (86400.0 / 60.0)

    def test_throughput_epm_hour_rollup_offset_of_hour(self):
        # Each of these denotes how many events to create in each hour
        event_counts = [6, 0, 6, 3, 0, 3]
        for hour, count in enumerate(event_counts):
            for minute in range(count):
                self.store_metric(
                    1, timestamp=self.day_ago + timedelta(hours=hour, minutes=minute + 30)
                )

        for axis in ["tpm()", "epm()"]:
            response = self.do_request(
                data={
                    "start": iso_format(self.day_ago + timedelta(minutes=30)),
                    "end": iso_format(self.day_ago + timedelta(hours=6, minutes=30)),
                    "interval": "1h",
                    "yAxis": axis,
                    "project": self.project.id,
                    "referrer": self.referrer,
                },
            )
            assert response.status_code == 200, response.content
            data = response.data["data"]
            assert len(data) == 6
            assert response.data["isMetricsData"]

            rows = data[0:6]
            for test in zip(event_counts, rows):
                assert test[1][1][0]["count"] == test[0] / (3600.0 / 60.0)

    def test_throughput_eps_minute_rollup(self):
        # Each of these denotes how many events to create in each minute
        event_counts = [6, 0, 6, 3, 0, 3]
        for minute, count in enumerate(event_counts):
            for second in range(count):
                self.store_metric(
                    1, timestamp=self.day_ago + timedelta(minutes=minute, seconds=second)
                )

        for axis in ["eps()", "tps()"]:
            response = self.do_request(
                data={
                    "start": iso_format(self.day_ago),
                    "end": iso_format(self.day_ago + timedelta(minutes=6)),
                    "interval": "1m",
                    "yAxis": axis,
                    "project": self.project.id,
                    "referrer": self.referrer,
                },
            )
            assert response.status_code == 200, response.content
            data = response.data["data"]
            assert len(data) == 6
            assert response.data["isMetricsData"]

            rows = data[0:6]
            for test in zip(event_counts, rows):
                assert test[1][1][0]["count"] == test[0] / 60.0

    def test_failure_rate(self):
        for hour in range(6):
            timestamp = self.day_ago + timedelta(hours=hour, minutes=30)
            self.store_metric(1, tags={"transaction.status": "ok"}, timestamp=timestamp)
            if hour < 3:
                self.store_metric(
                    1, tags={"transaction.status": "internal_error"}, timestamp=timestamp
                )

        response = self.do_request(
            data={
                "start": iso_format(self.day_ago),
                "end": iso_format(self.day_ago + timedelta(hours=6)),
                "interval": "1h",
                "yAxis": ["failure_rate()"],
                "project": self.project.id,
                "referrer": self.referrer,
            },
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 6
        assert response.data["isMetricsData"]
        assert [attrs for time, attrs in response.data["data"]] == [
            [{"count": 0.5}],
            [{"count": 0.5}],
            [{"count": 0.5}],
            [{"count": 0}],
            [{"count": 0}],
            [{"count": 0}],
        ]

    def test_percentiles_multi_axis(self):
        for hour in range(6):
            timestamp = self.day_ago + timedelta(hours=hour, minutes=30)
            self.store_metric(111, timestamp=timestamp)
            self.store_metric(222, metric="measurements.lcp", timestamp=timestamp)

        response = self.do_request(
            data={
                "start": iso_format(self.day_ago),
                "end": iso_format(self.day_ago + timedelta(hours=6)),
                "interval": "1h",
                "yAxis": ["p75(measurements.lcp)", "p75(transaction.duration)"],
                "project": self.project.id,
                "referrer": self.referrer,
            },
        )
        assert response.status_code == 200, response.content
        lcp = response.data["p75(measurements.lcp)"]
        duration = response.data["p75(transaction.duration)"]
        assert len(duration["data"]) == 6
        assert duration["isMetricsData"]
        assert len(lcp["data"]) == 6
        assert lcp["isMetricsData"]
        for item in duration["data"]:
            assert item[1][0]["count"] == 111
        for item in lcp["data"]:
            assert item[1][0]["count"] == 222

    @mock.patch("sentry.snuba.metrics_enhanced_performance.timeseries_query", return_value={})
    def test_multiple_yaxis_only_one_query(self, mock_query):
        self.do_request(
            data={
                "project": self.project.id,
                "start": iso_format(self.day_ago),
                "end": iso_format(self.day_ago + timedelta(hours=2)),
                "interval": "1h",
                "yAxis": ["epm()", "eps()", "tpm()", "p50(transaction.duration)"],
                "referrer": self.referrer,
            },
        )

        assert mock_query.call_count == 1

    def test_aggregate_function_user_count(self):
        self.store_metric(1, metric="user", timestamp=self.day_ago + timedelta(minutes=30))
        self.store_metric(1, metric="user", timestamp=self.day_ago + timedelta(hours=1, minutes=30))
        response = self.do_request(
            data={
                "start": iso_format(self.day_ago),
                "end": iso_format(self.day_ago + timedelta(hours=2)),
                "interval": "1h",
                "yAxis": "count_unique(user)",
                "referrer": self.referrer,
            },
        )
        assert response.status_code == 200, response.content
        assert response.data["isMetricsData"]
        assert [attrs for time, attrs in response.data["data"]] == [[{"count": 1}], [{"count": 1}]]

    def test_non_mep_query_fallsback(self):
        def get_mep(query):
            response = self.do_request(
                data={
                    "project": self.project.id,
                    "start": iso_format(self.day_ago),
                    "end": iso_format(self.day_ago + timedelta(hours=2)),
                    "interval": "1h",
                    "query": query,
                    "yAxis": ["epm()"],
                    "referrer": self.referrer,
                },
            )
            assert response.status_code == 200, response.content
            return response.data["isMetricsData"]

        assert get_mep(""), "empty query"
        assert get_mep("event.type:transaction"), "event type transaction"
        assert not get_mep("event.type:error"), "event type error"
        assert not get_mep("transaction.duration:<15min"), "outlier filter"
        assert get_mep("epm():>0.01"), "throughput filter"
        assert not get_mep(
            "event.type:transaction OR event.type:error"
        ), "boolean with non-mep filter"
        assert get_mep(
            "event.type:transaction OR transaction:foo_transaction"
        ), "boolean with mep filter"


class OrganizationEventsStatsTopNEvents(APITestCase, SnubaTestCase):
    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

        self.day_ago = before_now(days=1).replace(hour=10, minute=0, second=0, microsecond=0)

        self.project = self.create_project()
        self.project2 = self.create_project()
        self.user2 = self.create_user()
        transaction_data = load_data("transaction")
        transaction_data["start_timestamp"] = iso_format(self.day_ago + timedelta(minutes=2))
        transaction_data["timestamp"] = iso_format(self.day_ago + timedelta(minutes=4))
        transaction_data["tags"] = {"shared-tag": "yup"}
        self.event_data = [
            {
                "data": {
                    "message": "poof",
                    "timestamp": iso_format(self.day_ago + timedelta(minutes=2)),
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
                    "timestamp": iso_format(self.day_ago + timedelta(hours=1, minutes=2)),
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
                    "timestamp": iso_format(self.day_ago + timedelta(minutes=2)),
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
                    "timestamp": iso_format(self.day_ago + timedelta(minutes=2)),
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
                    "timestamp": iso_format(self.day_ago + timedelta(minutes=2)),
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
                    "timestamp": iso_format(self.day_ago + timedelta(minutes=2)),
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
            event = {}
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
            kwargs={"organization_slug": self.project.organization.slug},
        )

    def test_no_top_events_with_project_field(self):
        project = self.create_project()
        with self.feature(self.enabled_features):
            response = self.client.get(
                self.url,
                data={
                    # make sure to query the project with 0 events
                    "project": project.id,
                    "start": iso_format(self.day_ago),
                    "end": iso_format(self.day_ago + timedelta(hours=2)),
                    "interval": "1h",
                    "yAxis": "count()",
                    "orderby": ["-count()"],
                    "field": ["count()", "project"],
                    "topEvents": 5,
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
                    "project": project.id,
                    "start": iso_format(self.day_ago),
                    "end": iso_format(self.day_ago + timedelta(hours=2)),
                    "interval": "1h",
                    "yAxis": "count()",
                    "orderby": ["-count()"],
                    "field": ["count()", "message", "user.email"],
                    "topEvents": 5,
                },
                format="json",
            )

        data = response.data["data"]
        assert response.status_code == 200, response.content
        # When there are no top events, we do not return an empty dict.
        # Instead, we return a single zero-filled series for an empty graph.
        assert [attrs for time, attrs in data] == [[{"count": 0}], [{"count": 0}]]

    def test_simple_top_events(self):
        with self.feature(self.enabled_features):
            response = self.client.get(
                self.url,
                data={
                    "start": iso_format(self.day_ago),
                    "end": iso_format(self.day_ago + timedelta(hours=2)),
                    "interval": "1h",
                    "yAxis": "count()",
                    "orderby": ["-count()"],
                    "field": ["count()", "message", "user.email"],
                    "topEvents": 5,
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

    def test_top_events_limits(self):
        data = {
            "start": iso_format(self.day_ago),
            "end": iso_format(self.day_ago + timedelta(hours=2)),
            "interval": "1h",
            "yAxis": "count()",
            "orderby": ["-count()"],
            "field": ["count()", "message", "user.email"],
        }
        with self.feature(self.enabled_features):
            data["topEvents"] = MAX_TOP_EVENTS + 1
            response = self.client.get(self.url, data, format="json")
            assert response.status_code == 400

            data["topEvents"] = 0
            response = self.client.get(self.url, data, format="json")
            assert response.status_code == 400

            data["topEvents"] = "a"
            response = self.client.get(self.url, data, format="json")
            assert response.status_code == 400

    def test_top_events_with_projects(self):
        with self.feature(self.enabled_features):
            response = self.client.get(
                self.url,
                data={
                    "start": iso_format(self.day_ago),
                    "end": iso_format(self.day_ago + timedelta(hours=2)),
                    "interval": "1h",
                    "yAxis": "count()",
                    "orderby": ["-count()"],
                    "field": ["count()", "message", "project"],
                    "topEvents": 5,
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
                    "start": iso_format(self.day_ago),
                    "end": iso_format(self.day_ago + timedelta(hours=2)),
                    "interval": "1h",
                    "yAxis": "count()",
                    "orderby": ["-count()"],
                    "field": ["count()", "message", "issue"],
                    "topEvents": 5,
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
                    "start": iso_format(self.day_ago),
                    "end": iso_format(self.day_ago + timedelta(hours=2)),
                    "interval": "1h",
                    "yAxis": "count()",
                    "orderby": ["-count()"],
                    "field": ["count()", "issue"],
                    "topEvents": 5,
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
        "sentry.snuba.discover.raw_query",
        side_effect=[{"data": [{"group_id": 1}], "meta": []}, {"data": [], "meta": []}],
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
                    "start": iso_format(self.day_ago),
                    "end": iso_format(self.day_ago + timedelta(hours=2)),
                    "interval": "1h",
                    "yAxis": "count()",
                    "orderby": ["-count()"],
                    "field": ["count()", "message", "issue"],
                    "topEvents": 5,
                    "query": "!event.type:transaction",
                },
                format="json",
            )

        assert ["group_id", "IN", [1]] in mock_query.mock_calls[1].kwargs["conditions"]

    def test_top_events_with_functions(self):
        with self.feature(self.enabled_features):
            response = self.client.get(
                self.url,
                data={
                    "start": iso_format(self.day_ago),
                    "end": iso_format(self.day_ago + timedelta(hours=2)),
                    "interval": "1h",
                    "yAxis": "count()",
                    "orderby": ["-p99()"],
                    "field": ["transaction", "avg(transaction.duration)", "p99()"],
                    "topEvents": 5,
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
        transaction_data["start_timestamp"] = iso_format(self.day_ago + timedelta(minutes=2))
        transaction_data["timestamp"] = iso_format(self.day_ago + timedelta(minutes=6))
        transaction_data["transaction"] = "/foo_bar/"
        transaction2 = self.store_event(transaction_data, project_id=self.project.id)
        with self.feature(self.enabled_features):
            response = self.client.get(
                self.url,
                data={
                    "start": iso_format(self.day_ago),
                    "end": iso_format(self.day_ago + timedelta(hours=2)),
                    "interval": "1h",
                    "yAxis": "count()",
                    "orderby": ["-p99()"],
                    "field": ["transaction", "avg(transaction.duration)", "p99()"],
                    "topEvents": 5,
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
        transaction_data["start_timestamp"] = iso_format(self.day_ago + timedelta(minutes=2))
        transaction_data["timestamp"] = iso_format(self.day_ago + timedelta(minutes=6))
        transaction_data["transaction"] = "/foo_bar/"
        self.store_event(transaction_data, project_id=self.project.id)
        with self.feature(self.enabled_features):
            response = self.client.get(
                self.url,
                data={
                    "start": iso_format(self.day_ago),
                    "end": iso_format(self.day_ago + timedelta(hours=2)),
                    "interval": "1h",
                    "yAxis": "count()",
                    "orderby": ["-p99()"],
                    "query": "transaction:/foo_bar/",
                    "field": ["transaction", "avg(transaction.duration)", "p99()"],
                    "topEvents": 5,
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
                    "start": iso_format(self.day_ago),
                    "end": iso_format(self.day_ago + timedelta(hours=2)),
                    "interval": "1h",
                    "yAxis": "count()",
                    "orderby": ["-count()"],
                    "query": f"!message:{self.events[0].message}",
                    "field": ["message", "count()"],
                    "topEvents": 5,
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
                    "start": iso_format(self.day_ago),
                    "end": iso_format(self.day_ago + timedelta(hours=2)),
                    "interval": "1h",
                    "yAxis": "epm()",
                    "orderby": ["-count()"],
                    "field": ["message", "user.email", "count()"],
                    "topEvents": 5,
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
                    "start": iso_format(self.day_ago),
                    "end": iso_format(self.day_ago + timedelta(hours=2)),
                    "interval": "1h",
                    "yAxis": ["epm()", "count()"],
                    "orderby": ["-count()"],
                    "field": ["message", "user.email", "count()"],
                    "topEvents": 5,
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
                    "start": iso_format(self.day_ago),
                    "end": iso_format(self.day_ago + timedelta(hours=2)),
                    "interval": "1h",
                    "yAxis": "count()",
                    "orderby": ["-count()"],
                    "field": ["count()", "message", "device.charging"],
                    "topEvents": 5,
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
        prototype["message"] = "not handled"
        prototype["exception"]["values"][0]["value"] = "not handled"
        prototype["exception"]["values"][0]["mechanism"]["handled"] = False
        prototype["timestamp"] = iso_format(self.day_ago + timedelta(minutes=2))
        self.store_event(data=prototype, project_id=project.id)

        with self.feature(self.enabled_features):
            response = self.client.get(
                self.url,
                data={
                    "start": iso_format(self.day_ago),
                    "end": iso_format(self.day_ago + timedelta(hours=2)),
                    "interval": "1h",
                    "yAxis": "count()",
                    "orderby": ["-count()"],
                    "field": ["count()", "error.unhandled"],
                    "topEvents": 5,
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
                    "start": iso_format(self.day_ago),
                    "end": iso_format(self.day_ago + timedelta(hours=2)),
                    "interval": "1h",
                    "yAxis": "count()",
                    "orderby": ["-count()"],
                    "query": "event.type:default",
                    "field": ["count()", "message", "timestamp"],
                    "topEvents": 5,
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
                    "start": iso_format(self.day_ago),
                    "end": iso_format(self.day_ago + timedelta(hours=2)),
                    "interval": "1h",
                    "yAxis": "count()",
                    "orderby": ["-count()"],
                    "field": ["count()", "message", "transaction.duration"],
                    "topEvents": 5,
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
                    "start": iso_format(self.day_ago),
                    "end": iso_format(self.day_ago + timedelta(hours=2)),
                    "interval": "1h",
                    "yAxis": "count()",
                    "orderby": ["-count()", "user"],
                    "field": ["user", "count()"],
                    "topEvents": 5,
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
                    "start": iso_format(self.day_ago),
                    "end": iso_format(self.day_ago + timedelta(hours=2)),
                    "interval": "1h",
                    "yAxis": "count()",
                    "orderby": ["-count()", "user"],
                    "field": ["user", "user.email", "count()"],
                    "topEvents": 5,
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
                    "start": iso_format(self.day_ago),
                    "end": iso_format(self.day_ago + timedelta(hours=2)),
                    "interval": "1h",
                    "yAxis": "count()",
                    "orderby": ["-count()"],
                    "field": ["message", "user.display", "count()"],
                    "topEvents": 5,
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
                    "start": iso_format(self.day_ago),
                    "end": iso_format(self.day_ago + timedelta(hours=2)),
                    "interval": "1h",
                    "yAxis": "count()",
                    "orderby": ["-count()"],
                    "field": ["count()", "issue"],
                    "topEvents": 5,
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
                    "start": iso_format(self.day_ago),
                    "end": iso_format(self.day_ago + timedelta(hours=2)),
                    "interval": "1h",
                    "yAxis": "count()",
                    "orderby": ["-count()"],
                    "query": "event.type:transaction",
                    "field": ["count()", "issue"],
                    "topEvents": 5,
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
                    "start": iso_format(self.day_ago),
                    "end": iso_format(self.day_ago + timedelta(hours=2)),
                    "interval": "1h",
                    "yAxis": "count()",
                    "orderby": ["-count()"],
                    "field": ["count()", "error.handled"],
                    "topEvents": 5,
                    "query": "!event.type:transaction",
                },
                format="json",
            )

        assert response.status_code == 200, response.content
        data = response.data

        assert len(data) == 3

        results = data[""]
        assert [attrs for time, attrs in results["data"]] == [[{"count": 19}], [{"count": 6}]]
        assert results["order"] == 0

        results = data["1"]
        assert [attrs for time, attrs in results["data"]] == [[{"count": 1}], [{"count": 0}]]

        results = data["0"]
        assert [attrs for time, attrs in results["data"]] == [[{"count": 1}], [{"count": 0}]]

    def test_top_events_with_aggregate_condition(self):
        with self.feature(self.enabled_features):
            response = self.client.get(
                self.url,
                data={
                    "start": iso_format(self.day_ago),
                    "end": iso_format(self.day_ago + timedelta(hours=2)),
                    "interval": "1h",
                    "yAxis": "count()",
                    "orderby": ["-count()"],
                    "field": ["message", "count()"],
                    "query": "count():>4",
                    "topEvents": 5,
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
                    "start": iso_format(self.day_ago),
                    "end": iso_format(self.day_ago + timedelta(hours=2)),
                    "interval": "1h",
                    "yAxis": "count()",
                    # the double underscores around the version alias is because of a comma and quote
                    "orderby": [f"-to_other_release__{version_alias}__others_current"],
                    "field": [
                        "count()",
                        f'to_other(release,"{version_escaped}",others,current)',
                    ],
                    "topEvents": 2,
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
                    "start": iso_format(self.day_ago),
                    "end": iso_format(self.day_ago + timedelta(hours=2)),
                    "interval": "1h",
                    "yAxis": "equation|count() / 100",
                    "orderby": ["-count()"],
                    "field": ["count()", "message", "user.email", "equation|count() / 100"],
                    "topEvents": 5,
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

    @mock.patch("sentry.snuba.discover.bulk_raw_query", return_value=[{"data": [], "meta": []}])
    @mock.patch("sentry.snuba.discover.raw_query", return_value={"data": [], "meta": []})
    def test_invalid_interval(self, mock_raw_query, mock_bulk_query):
        with self.feature(self.enabled_features):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "end": iso_format(before_now()),
                    # 7,200 points for each event
                    "start": iso_format(before_now(seconds=7200)),
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
                    "end": iso_format(before_now()),
                    "start": iso_format(before_now(seconds=7200)),
                    "field": ["count()", "issue"],
                    "query": "",
                    "interval": "1s",
                    "yAxis": "count()",
                    # 7,200 points for each event * 2, should error
                    "topEvents": 2,
                },
            )
        assert response.status_code == 200
        assert mock_raw_query.call_count == 2
        # Should've reset to the default for between 1 and 24h
        assert mock_raw_query.mock_calls[1].kwargs["rollup"] == 300

        with self.feature(self.enabled_features):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "end": iso_format(before_now()),
                    # 1999 points * 5 events should just be enough to not error
                    "start": iso_format(before_now(seconds=1999)),
                    "field": ["count()", "issue"],
                    "query": "",
                    "interval": "1s",
                    "yAxis": "count()",
                    "topEvents": 5,
                },
            )
        assert response.status_code == 200
        assert mock_raw_query.call_count == 4
        # Should've left the interval alone since we're just below the limit
        assert mock_raw_query.mock_calls[3].kwargs["rollup"] == 1

        with self.feature(self.enabled_features):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "end": iso_format(before_now()),
                    "start": iso_format(before_now(hours=24)),
                    "field": ["count()", "issue"],
                    "query": "",
                    "interval": "0d",
                    "yAxis": "count()",
                    "topEvents": 5,
                },
            )
        assert response.status_code == 200
        assert mock_raw_query.call_count == 6
        # Should've default to 24h's default of 5m
        assert mock_raw_query.mock_calls[5].kwargs["rollup"] == 300

    def test_top_events_timestamp_fields(self):
        with self.feature(self.enabled_features):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "start": iso_format(self.day_ago),
                    "end": iso_format(self.day_ago + timedelta(hours=2)),
                    "interval": "1h",
                    "yAxis": "count()",
                    "orderby": ["-count()"],
                    "field": ["count()", "timestamp", "timestamp.to_hour", "timestamp.to_day"],
                    "topEvents": 5,
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
            key = f"{iso_format(ts)}+00:00,{iso_format(ts_day)}+00:00,{iso_format(ts_hr)}+00:00"
            count = sum(
                e["count"] for e in self.event_data if e["data"]["timestamp"] == iso_format(ts)
            )
            results = data[key]
            assert [{"count": count}] in [attrs for time, attrs in results["data"]]

    def test_top_events_other_with_matching_columns(self):
        with self.feature(self.enabled_features):
            response = self.client.get(
                self.url,
                data={
                    "start": iso_format(self.day_ago),
                    "end": iso_format(self.day_ago + timedelta(hours=2)),
                    "interval": "1h",
                    "yAxis": "count()",
                    "orderby": ["-count()"],
                    "field": ["count()", "tags[shared-tag]", "message"],
                    "topEvents": 5,
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
        transaction_data["start_timestamp"] = iso_format(self.day_ago + timedelta(minutes=2))
        transaction_data["timestamp"] = iso_format(self.day_ago + timedelta(minutes=6))
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
                    "start": iso_format(self.day_ago),
                    "end": iso_format(self.day_ago + timedelta(hours=2)),
                    "interval": "1h",
                    "yAxis": "count()",
                    "orderby": ["-count()"],
                    "field": ["count()", "message"],
                    "topEvents": 5,
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


class OrganizationEventsStatsTopNEventsWithSnql(OrganizationEventsStatsTopNEvents):
    def setUp(self):
        super().setUp()
        self.enabled_features["organizations:discover-use-snql"] = True

    # Separate test for now to keep the patching simpler
    @mock.patch("sentry.snuba.discover.bulk_snql_query", return_value=[{"data": [], "meta": []}])
    @mock.patch(
        "sentry.search.events.builder.raw_snql_query", return_value={"data": [], "meta": []}
    )
    def test_invalid_interval(self, mock_raw_query, mock_bulk_query):
        with self.feature(self.enabled_features):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "end": iso_format(before_now()),
                    # 7,200 points for each event
                    "start": iso_format(before_now(seconds=7200)),
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
                    "end": iso_format(before_now()),
                    "start": iso_format(before_now(seconds=7200)),
                    "field": ["count()", "issue"],
                    "query": "",
                    "interval": "1s",
                    "yAxis": "count()",
                    # 7,200 points for each event * 2, should error
                    "topEvents": 2,
                },
            )
        assert response.status_code == 200
        assert mock_raw_query.call_count == 2
        # Should've reset to the default for between 1 and 24h
        assert mock_raw_query.mock_calls[1].args[0].granularity.granularity == 300

        with self.feature(self.enabled_features):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "end": iso_format(before_now()),
                    # 1999 points * 5 events should just be enough to not error
                    "start": iso_format(before_now(seconds=1999)),
                    "field": ["count()", "issue"],
                    "query": "",
                    "interval": "1s",
                    "yAxis": "count()",
                    "topEvents": 5,
                },
            )
        assert response.status_code == 200
        assert mock_raw_query.call_count == 4
        # Should've left the interval alone since we're just below the limit
        assert mock_raw_query.mock_calls[3].args[0].granularity.granularity == 1

        with self.feature(self.enabled_features):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "end": iso_format(before_now()),
                    "start": iso_format(before_now(hours=24)),
                    "field": ["count()", "issue"],
                    "query": "",
                    "interval": "0d",
                    "yAxis": "count()",
                    "topEvents": 5,
                },
            )
        assert response.status_code == 200
        assert mock_raw_query.call_count == 6
        # Should've default to 24h's default of 5m
        assert mock_raw_query.mock_calls[5].args[0].granularity.granularity == 300

    @mock.patch(
        "sentry.search.events.builder.raw_snql_query",
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
                    "start": iso_format(self.day_ago),
                    "end": iso_format(self.day_ago + timedelta(hours=2)),
                    "interval": "1h",
                    "yAxis": "count()",
                    "orderby": ["-count()"],
                    "field": ["count()", "message", "issue"],
                    "topEvents": 5,
                    "query": "!event.type:transaction",
                },
                format="json",
            )

        assert (
            Condition(Function("coalesce", [Column("group_id"), 0], "issue.id"), Op.IN, [1])
            in mock_query.mock_calls[1].args[0].where
        )

    def test_top_events_boolean_condition_and_project_field(self):
        with self.feature(self.enabled_features):
            response = self.client.get(
                self.url,
                data={
                    "start": iso_format(self.day_ago),
                    "end": iso_format(self.day_ago + timedelta(hours=2)),
                    "interval": "1h",
                    "yAxis": "count()",
                    "orderby": ["-count()"],
                    "field": ["project", "count()"],
                    "topEvents": 5,
                    "query": "event.type:transaction (transaction:*a OR transaction:b*)",
                },
                format="json",
            )

        assert response.status_code == 200

    def test_top_events_with_to_other(self):
        super().test_top_events_with_to_other()
