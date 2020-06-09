from __future__ import absolute_import

import mock
import six
import uuid

from pytz import utc
from datetime import timedelta

from django.core.urlresolvers import reverse

from sentry.testutils import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import iso_format, before_now
from sentry.utils.compat import zip
from sentry.utils.samples import load_data


class OrganizationEventsStatsEndpointTest(APITestCase, SnubaTestCase):
    def setUp(self):
        super(OrganizationEventsStatsEndpointTest, self).setUp()
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

    def test_simple(self):
        response = self.client.get(
            self.url,
            data={
                "start": iso_format(self.day_ago),
                "end": iso_format(self.day_ago + timedelta(hours=2)),
                "interval": "1h",
            },
            format="json",
        )

        assert response.status_code == 200, response.content
        assert [attrs for time, attrs in response.data["data"]] == [
            [{"count": 1}],
            [{"count": 2}],
            [{"count": 0}],
        ]

    def test_no_projects(self):
        org = self.create_organization(owner=self.user)
        self.login_as(user=self.user)

        url = reverse(
            "sentry-api-0-organization-events-stats", kwargs={"organization_slug": org.slug}
        )
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 0

    def test_groupid_filter(self):
        response = self.client.get(
            self.url,
            data={
                "start": iso_format(self.day_ago),
                "end": iso_format(self.day_ago + timedelta(hours=1, minutes=59)),
                "interval": "1h",
                "group": self.group.id,
            },
            format="json",
        )

        assert response.status_code == 200, response.content
        assert len(response.data["data"])

    def test_groupid_filter_invalid_value(self):
        url = "%s?group=not-a-number" % (self.url,)
        with self.feature({"organizations:discover-basic": False}):
            response = self.client.get(url, format="json")

            assert response.status_code == 400, response.content

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
        response = self.client.get(
            self.url,
            data={
                "start": iso_format(self.day_ago),
                "end": iso_format(self.day_ago + timedelta(hours=1, minutes=59)),
                "interval": "1h",
                "yAxis": "user_count",
            },
            format="json",
        )
        assert response.status_code == 200, response.content
        assert [attrs for time, attrs in response.data["data"]] == [[{"count": 2}], [{"count": 1}]]

    def test_discover2_backwards_compatibility(self):
        with self.feature("organizations:discover-basic"):
            response = self.client.get(
                self.url,
                data={
                    "start": iso_format(self.day_ago),
                    "end": iso_format(self.day_ago + timedelta(hours=1, minutes=59)),
                    "interval": "1h",
                    "yAxis": "user_count",
                },
                format="json",
            )
            assert response.status_code == 200, response.content
            assert len(response.data["data"]) > 0

        with self.feature("organizations:discover-basic"):
            response = self.client.get(
                self.url,
                data={
                    "start": iso_format(self.day_ago),
                    "end": iso_format(self.day_ago + timedelta(hours=1, minutes=59)),
                    "interval": "1h",
                    "yAxis": "event_count",
                },
                format="json",
            )
            assert response.status_code == 200, response.content
            assert len(response.data["data"]) > 0

    def test_with_event_count_flag(self):
        response = self.client.get(
            self.url,
            data={
                "start": iso_format(self.day_ago),
                "end": iso_format(self.day_ago + timedelta(hours=1, minutes=59)),
                "interval": "1h",
                "yAxis": "event_count",
            },
            format="json",
        )

        assert response.status_code == 200, response.content
        assert [attrs for time, attrs in response.data["data"]] == [[{"count": 1}], [{"count": 2}]]

    def test_performance_view_feature(self):
        with self.feature(
            {"organizations:performance-view": True, "organizations:discover-basic": False}
        ):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "end": iso_format(before_now()),
                    "start": iso_format(before_now(hours=2)),
                    "query": "project_id:1",
                    "interval": "30m",
                    "yAxis": "count()",
                },
            )
        assert response.status_code == 200

    def test_aggregate_function_count(self):
        with self.feature("organizations:discover-basic"):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "start": iso_format(self.day_ago),
                    "end": iso_format(self.day_ago + timedelta(hours=1, minutes=59)),
                    "interval": "1h",
                    "yAxis": "count()",
                },
            )
        assert response.status_code == 200, response.content
        assert [attrs for time, attrs in response.data["data"]] == [[{"count": 1}], [{"count": 2}]]

    def test_invalid_aggregate(self):
        with self.feature("organizations:discover-basic"):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "start": iso_format(self.day_ago),
                    "end": iso_format(self.day_ago + timedelta(hours=1, minutes=59)),
                    "interval": "1h",
                    "yAxis": "rubbish",
                },
            )
        assert response.status_code == 400, response.content

    def test_aggregate_function_user_count(self):
        with self.feature("organizations:discover-basic"):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "start": iso_format(self.day_ago),
                    "end": iso_format(self.day_ago + timedelta(hours=1, minutes=59)),
                    "interval": "1h",
                    "yAxis": "count_unique(user)",
                },
            )
        assert response.status_code == 200, response.content
        assert [attrs for time, attrs in response.data["data"]] == [[{"count": 1}], [{"count": 1}]]

    def test_aggregate_invalid(self):
        with self.feature("organizations:discover-basic"):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "start": iso_format(self.day_ago),
                    "end": iso_format(self.day_ago + timedelta(hours=1, minutes=59)),
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
                        "event_id": six.binary_type(six.text_type(uuid.uuid1()).encode("ascii")),
                        "message": "very bad",
                        "timestamp": iso_format(
                            self.day_ago + timedelta(hours=hour, minutes=minute)
                        ),
                        "fingerprint": ["group1"],
                        "tags": {"sentry:user": self.user.email},
                    },
                    project_id=project.id,
                )

        with self.feature("organizations:discover-basic"):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "start": iso_format(self.day_ago),
                    "end": iso_format(self.day_ago + timedelta(hours=6)),
                    "interval": "1h",
                    "yAxis": "epm()",
                    "project": project.id,
                },
            )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 7

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
                        "event_id": six.binary_type(six.text_type(uuid.uuid1()).encode("ascii")),
                        "message": "very bad",
                        "timestamp": iso_format(
                            self.day_ago + timedelta(hours=hour, minutes=minute)
                        ),
                        "fingerprint": ["group1"],
                        "tags": {"sentry:user": self.user.email},
                    },
                    project_id=project.id,
                )

        with self.feature("organizations:discover-basic"):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "start": iso_format(self.day_ago),
                    "end": iso_format(self.day_ago + timedelta(hours=6)),
                    "interval": "24h",
                    "yAxis": "epm()",
                    "project": project.id,
                },
            )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 1

        assert data[0][1][0]["count"] == sum(event_counts) / (86400.0 / 60.0)

    def test_throughput_eps_minute_rollup(self):
        project = self.create_project()
        # Each of these denotes how many events to create in each minute
        event_counts = [6, 0, 6, 3, 0, 3]
        for minute, count in enumerate(event_counts):
            for second in range(count):
                self.store_event(
                    data={
                        "event_id": six.binary_type(six.text_type(uuid.uuid1()).encode("ascii")),
                        "message": "very bad",
                        "timestamp": iso_format(
                            self.day_ago + timedelta(minutes=minute, seconds=second)
                        ),
                        "fingerprint": ["group1"],
                        "tags": {"sentry:user": self.user.email},
                    },
                    project_id=project.id,
                )

        with self.feature("organizations:discover-basic"):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "start": iso_format(self.day_ago),
                    "end": iso_format(self.day_ago + timedelta(minutes=6)),
                    "interval": "1m",
                    "yAxis": "eps()",
                    "project": project.id,
                },
            )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 7

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
                        "event_id": six.binary_type(six.text_type(uuid.uuid1()).encode("ascii")),
                        "message": "very bad",
                        "timestamp": iso_format(
                            self.day_ago + timedelta(minutes=minute, seconds=second)
                        ),
                        "fingerprint": ["group1"],
                        "tags": {"sentry:user": self.user.email},
                    },
                    project_id=project.id,
                )

        with self.feature("organizations:discover-basic"):
            response = self.client.get(
                self.url,
                format="json",
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

        # expect 61 data points between time span of 0 and 60 seconds
        assert len(data) == 61

        rows = data[0:6]

        for row in rows:
            assert row[1][0]["count"] == 1

    def test_with_field_and_reference_event_invalid(self):
        with self.feature("organizations:discover-basic"):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "start": iso_format(self.day_ago),
                    "end": iso_format(self.day_ago + timedelta(hours=1, minutes=59)),
                    "interval": "1h",
                    "referenceEvent": "nope-invalid",
                    "yAxis": "count()",
                },
            )
        assert response.status_code == 400, response.content
        assert "reference" in response.content

    def test_only_reference_event(self):
        # Create a new event that message matches events made in setup
        event = self.store_event(
            data={
                "event_id": "e" * 32,
                "message": "oh my",
                "timestamp": iso_format(self.day_ago + timedelta(minutes=2)),
                "tags": {"sentry:user": "bob@example.com"},
                "fingerprint": ["group3"],
            },
            project_id=self.project.id,
        )
        with self.feature("organizations:discover-basic"):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "start": iso_format(self.day_ago),
                    "end": iso_format(self.day_ago + timedelta(hours=1, minutes=59)),
                    "interval": "1h",
                    "referenceEvent": "%s:%s" % (self.project.slug, event.event_id),
                    "yAxis": "count()",
                },
            )
        assert response.status_code == 200, response.content
        # Because we didn't send fields, the reference event is not applied
        assert [attrs for time, attrs in response.data["data"]] == [[{"count": 2}], [{"count": 2}]]

    def test_field_and_reference_event(self):
        # Create a new event that message matches events made in setup
        event = self.store_event(
            data={
                "event_id": "e" * 32,
                "message": "oh my",
                "timestamp": iso_format(self.day_ago + timedelta(minutes=2)),
                "tags": {"sentry:user": "bob@example.com"},
                "fingerprint": ["group3"],
            },
            project_id=self.project.id,
        )
        with self.feature("organizations:discover-basic"):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "start": iso_format(self.day_ago),
                    "end": iso_format(self.day_ago + timedelta(hours=1, minutes=59)),
                    "field": ["message", "count()"],
                    "interval": "1h",
                    "referenceEvent": "%s:%s" % (self.project.slug, event.event_id),
                    "yAxis": "count()",
                },
            )
        assert response.status_code == 200, response.content
        assert [attrs for time, attrs in response.data["data"]] == [[{"count": 1}], [{"count": 1}]]

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

        with self.feature("organizations:discover-basic"):
            response = self.client.get(
                self.url,
                format="json",
                data={
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
        with self.feature("organizations:discover-basic"):
            response = self.client.get(
                self.url,
                format="json",
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
        with self.feature("organizations:discover-basic"):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "end": iso_format(before_now()),
                    "start": iso_format(before_now(hours=2)),
                    "query": "release:latest",
                    "interval": "30m",
                    "yAxis": "count()",
                },
            )
        assert response.status_code == 200

    def test_simple_multiple_yaxis(self):
        with self.feature("organizations:discover-basic"):
            response = self.client.get(
                self.url,
                data={
                    "start": iso_format(self.day_ago),
                    "end": iso_format(self.day_ago + timedelta(hours=1, minutes=59)),
                    "interval": "1h",
                    "yAxis": ["user_count", "event_count"],
                },
                format="json",
            )

        assert response.status_code == 200, response.content
        response.data["user_count"]["order"] == 0
        assert [attrs for time, attrs in response.data["user_count"]["data"]] == [
            [{"count": 1}],
            [{"count": 1}],
        ]
        response.data["event_count"]["order"] == 1
        assert [attrs for time, attrs in response.data["event_count"]["data"]] == [
            [{"count": 1}],
            [{"count": 2}],
        ]

    @mock.patch("sentry.snuba.discover.timeseries_query", return_value={})
    def test_multiple_yaxis_only_one_query(self, mock_query):
        with self.feature("organizations:discover-basic"):
            self.client.get(
                self.url,
                data={
                    "start": iso_format(self.day_ago),
                    "end": iso_format(self.day_ago + timedelta(hours=1, minutes=59)),
                    "interval": "1h",
                    "yAxis": ["user_count", "event_count", "epm()", "eps()"],
                },
                format="json",
            )

        assert mock_query.call_count == 1

    def test_invalid_interval(self):
        with self.feature("organizations:discover-basic"):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "end": iso_format(before_now()),
                    "start": iso_format(before_now(hours=24)),
                    "query": "",
                    "interval": "1s",
                    "yAxis": "count()",
                },
            )
        assert response.status_code == 400

    def test_out_of_retention(self):
        with self.options({"system.event-retention-days": 10}):
            with self.feature("organizations:discover-basic"):
                response = self.client.get(
                    self.url,
                    format="json",
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
        with self.feature("organizations:discover-basic"):
            # Don't quantize short time periods
            self.client.get(
                self.url,
                format="json",
                data={"statsPeriod": "1h", "query": "", "interval": "30m", "yAxis": "count()"},
            )
            # Don't quantize absolute date periods
            self.client.get(
                self.url,
                format="json",
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
            self.client.get(
                self.url,
                format="json",
                data={"statsPeriod": "90d", "query": "", "interval": "30m", "yAxis": "count()"},
            )

            assert len(mock_quantize.mock_calls) == 2


class OrganizationEventsStatsTopNEvents(APITestCase, SnubaTestCase):
    def setUp(self):
        super(OrganizationEventsStatsTopNEvents, self).setUp()
        self.login_as(user=self.user)

        self.day_ago = before_now(days=1).replace(hour=10, minute=0, second=0, microsecond=0)

        self.project = self.create_project()
        self.project2 = self.create_project()
        self.user2 = self.create_user()
        transaction_data = load_data("transaction")
        transaction_data["start_timestamp"] = iso_format(self.day_ago + timedelta(minutes=2))
        transaction_data["timestamp"] = iso_format(self.day_ago + timedelta(minutes=4))
        self.event_data = [
            {
                "data": {
                    "message": "poof",
                    "timestamp": iso_format(self.day_ago + timedelta(minutes=2)),
                    "user": {"email": self.user.email},
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
                },
                "project": self.project,
                "count": 1,
            },
        ]

        self.events = []
        for index, event_data in enumerate(self.event_data):
            data = event_data["data"].copy()
            for i in range(event_data["count"]):
                data["event_id"] = "{}{}".format(index, i) * 16
                event = self.store_event(data, project_id=event_data["project"].id)
            self.events.append(event)
        self.transaction = self.events[4]

        self.url = reverse(
            "sentry-api-0-organization-events-stats",
            kwargs={"organization_slug": self.project.organization.slug},
        )

    def test_simple_top_events(self):
        with self.feature("organizations:discover-basic"):
            response = self.client.get(
                self.url,
                data={
                    "start": iso_format(self.day_ago),
                    "end": iso_format(self.day_ago + timedelta(hours=1, minutes=59)),
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
        assert len(data) == 5

        for index, event in enumerate(self.events[:5]):
            message = event.message or event.transaction
            results = data[
                ",".join([message, self.event_data[index]["data"]["user"].get("email", "None")])
            ]
            assert results["order"] == index
            assert [{"count": self.event_data[index]["count"]}] in [
                attrs for time, attrs in results["data"]
            ]

    def test_top_events_limits(self):
        data = {
            "start": iso_format(self.day_ago),
            "end": iso_format(self.day_ago + timedelta(hours=1, minutes=59)),
            "interval": "1h",
            "yAxis": "count()",
            "orderby": ["-count()"],
            "field": ["count()", "message", "user.email"],
        }
        with self.feature("organizations:discover-basic"):
            data["topEvents"] = 50
            response = self.client.get(self.url, data, format="json",)
            assert response.status_code == 400

            data["topEvents"] = 0
            response = self.client.get(self.url, data, format="json",)
            assert response.status_code == 400

            data["topEvents"] = "a"
            response = self.client.get(self.url, data, format="json",)
            assert response.status_code == 400

    def test_top_events_with_projects(self):
        with self.feature("organizations:discover-basic"):
            response = self.client.get(
                self.url,
                data={
                    "start": iso_format(self.day_ago),
                    "end": iso_format(self.day_ago + timedelta(hours=1, minutes=59)),
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
        assert len(data) == 5

        for index, event in enumerate(self.events[:5]):
            message = event.message or event.transaction
            results = data[",".join([message, event.project.slug])]
            assert results["order"] == index
            assert [{"count": self.event_data[index]["count"]}] in [
                attrs for time, attrs in results["data"]
            ]

    def test_top_events_with_issue(self):
        # delete a group to make sure if this happens the value becomes unknown
        event_group = self.events[0].group
        event_group.delete()

        with self.feature("organizations:discover-basic"):
            response = self.client.get(
                self.url,
                data={
                    "start": iso_format(self.day_ago),
                    "end": iso_format(self.day_ago + timedelta(hours=1, minutes=59)),
                    "interval": "1h",
                    "yAxis": "count()",
                    "orderby": ["-count()"],
                    "field": ["count()", "message", "issue"],
                    "topEvents": 5,
                },
                format="json",
            )

        data = response.data

        assert response.status_code == 200, response.content
        assert len(data) == 5

        for index, event in enumerate(self.events[:5]):
            message = event.message or event.transaction
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

    def test_top_events_with_functions(self):
        with self.feature("organizations:discover-basic"):
            response = self.client.get(
                self.url,
                data={
                    "start": iso_format(self.day_ago),
                    "end": iso_format(self.day_ago + timedelta(hours=1, minutes=59)),
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
        assert [attrs for time, attrs in results["data"]] == [
            [{"count": 3}],
            [{"count": 0}],
        ]

    def test_top_events_with_functions_on_different_transactions(self):
        """ Transaction2 has less events, but takes longer so order should be self.transaction then transaction2 """
        transaction_data = load_data("transaction")
        transaction_data["start_timestamp"] = iso_format(self.day_ago + timedelta(minutes=2))
        transaction_data["timestamp"] = iso_format(self.day_ago + timedelta(minutes=6))
        transaction_data["transaction"] = "/foo_bar/"
        transaction2 = self.store_event(transaction_data, project_id=self.project.id)
        with self.feature("organizations:discover-basic"):
            response = self.client.get(
                self.url,
                data={
                    "start": iso_format(self.day_ago),
                    "end": iso_format(self.day_ago + timedelta(hours=1, minutes=59)),
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
        assert [attrs for time, attrs in results["data"]] == [
            [{"count": 3}],
            [{"count": 0}],
        ]

        results = data[transaction2.transaction]
        assert results["order"] == 0
        assert [attrs for time, attrs in results["data"]] == [
            [{"count": 1}],
            [{"count": 0}],
        ]

    def test_top_events_with_query(self):
        transaction_data = load_data("transaction")
        transaction_data["start_timestamp"] = iso_format(self.day_ago + timedelta(minutes=2))
        transaction_data["timestamp"] = iso_format(self.day_ago + timedelta(minutes=6))
        transaction_data["transaction"] = "/foo_bar/"
        self.store_event(transaction_data, project_id=self.project.id)
        with self.feature("organizations:discover-basic"):
            response = self.client.get(
                self.url,
                data={
                    "start": iso_format(self.day_ago),
                    "end": iso_format(self.day_ago + timedelta(hours=1, minutes=59)),
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

    def test_top_events_with_epm(self):
        with self.feature("organizations:discover-basic"):
            response = self.client.get(
                self.url,
                data={
                    "start": iso_format(self.day_ago),
                    "end": iso_format(self.day_ago + timedelta(hours=1, minutes=59)),
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
        assert len(data) == 5

        for index, event in enumerate(self.events[:5]):
            message = event.message or event.transaction
            results = data[
                ",".join([message, self.event_data[index]["data"]["user"].get("email", "None")])
            ]
            assert results["order"] == index
            assert [{"count": self.event_data[index]["count"] / (3600.0 / 60.0)}] in [
                attrs for time, attrs in results["data"]
            ]

    def test_top_events_with_multiple_yaxis(self):
        with self.feature("organizations:discover-basic"):
            response = self.client.get(
                self.url,
                data={
                    "start": iso_format(self.day_ago),
                    "end": iso_format(self.day_ago + timedelta(hours=1, minutes=59)),
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
        assert len(data) == 5

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

    def test_top_events_with_boolean(self):
        with self.feature("organizations:discover-basic"):
            response = self.client.get(
                self.url,
                data={
                    "start": iso_format(self.day_ago),
                    "end": iso_format(self.day_ago + timedelta(hours=1, minutes=59)),
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
        assert len(data) == 5

        for index, event in enumerate(self.events[:5]):
            message = event.message or event.transaction
            results = data[",".join(["False", message])]
            assert results["order"] == index
            assert [{"count": self.event_data[index]["count"]}] in [
                attrs for time, attrs in results["data"]
            ]

    def test_top_events_with_timestamp(self):
        with self.feature("organizations:discover-basic"):
            response = self.client.get(
                self.url,
                data={
                    "start": iso_format(self.day_ago),
                    "end": iso_format(self.day_ago + timedelta(hours=1, minutes=59)),
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
        assert len(data) == 5
        # Transactions won't be in the results because of the query
        del self.events[4]
        del self.event_data[4]

        for index, event in enumerate(self.events[:5]):
            results = data[",".join([event.message, event.timestamp])]
            assert results["order"] == index
            assert [{"count": self.event_data[index]["count"]}] in [
                attrs for time, attrs in results["data"]
            ]

    def test_top_events_with_int(self):
        with self.feature("organizations:discover-basic"):
            response = self.client.get(
                self.url,
                data={
                    "start": iso_format(self.day_ago),
                    "end": iso_format(self.day_ago + timedelta(hours=1, minutes=59)),
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
        assert [attrs for time, attrs in results["data"]] == [
            [{"count": 3}],
            [{"count": 0}],
        ]

    def test_top_events_with_user(self):
        with self.feature("organizations:discover-basic"):
            response = self.client.get(
                self.url,
                data={
                    "start": iso_format(self.day_ago),
                    "end": iso_format(self.day_ago + timedelta(hours=1, minutes=59)),
                    "interval": "1h",
                    "yAxis": "count()",
                    "orderby": ["-count()"],
                    "field": ["user", "count()"],
                    "topEvents": 5,
                },
                format="json",
            )

        data = response.data
        assert response.status_code == 200, response.content
        assert len(data) == 5

        assert data["bar@example.com"]["order"] == 0
        assert [attrs for time, attrs in data["bar@example.com"]["data"]] == [
            [{"count": 7}],
            [{"count": 0}],
        ]
        assert [attrs for time, attrs in data["127.0.0.1"]["data"]] == [
            [{"count": 3}],
            [{"count": 0}],
        ]

    def test_top_events_with_user_and_email(self):
        with self.feature("organizations:discover-basic"):
            response = self.client.get(
                self.url,
                data={
                    "start": iso_format(self.day_ago),
                    "end": iso_format(self.day_ago + timedelta(hours=1, minutes=59)),
                    "interval": "1h",
                    "yAxis": "count()",
                    "orderby": ["-count()"],
                    "field": ["user", "user.email", "count()"],
                    "topEvents": 5,
                },
                format="json",
            )

        data = response.data
        assert response.status_code == 200, response.content
        assert len(data) == 5

        assert data["bar@example.com,bar@example.com"]["order"] == 0
        assert [attrs for time, attrs in data["bar@example.com,bar@example.com"]["data"]] == [
            [{"count": 7}],
            [{"count": 0}],
        ]
        assert [attrs for time, attrs in data["127.0.0.1,None"]["data"]] == [
            [{"count": 3}],
            [{"count": 0}],
        ]

    def test_top_events_none_filter(self):
        """ When a field is None in one of the top events, make sure we filter by it

            In this case event[4] is a transaction and has no issue
        """
        with self.feature("organizations:discover-basic"):
            response = self.client.get(
                self.url,
                data={
                    "start": iso_format(self.day_ago),
                    "end": iso_format(self.day_ago + timedelta(hours=1, minutes=59)),
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

    def test_top_events_one_field_with_none(self):
        with self.feature("organizations:discover-basic"):
            response = self.client.get(
                self.url,
                data={
                    "start": iso_format(self.day_ago),
                    "end": iso_format(self.day_ago + timedelta(hours=1, minutes=59)),
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
        assert [attrs for time, attrs in results["data"]] == [
            [{"count": 3}],
            [{"count": 0}],
        ]
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
        with self.feature("organizations:discover-basic"):
            response = self.client.get(
                self.url,
                data={
                    "start": iso_format(self.day_ago),
                    "end": iso_format(self.day_ago + timedelta(hours=1, minutes=59)),
                    "interval": "1h",
                    "yAxis": "count()",
                    "orderby": ["-count()"],
                    "field": ["count()", "error.handled"],
                    "topEvents": 5,
                },
                format="json",
            )

        assert response.status_code == 200, response.content
        data = response.data
        assert len(data) == 3

        results = data[""]
        assert [attrs for time, attrs in results["data"]] == [
            [{"count": 22}],
            [{"count": 6}],
        ]
        assert results["order"] == 0

        results = data["1"]
        assert [attrs for time, attrs in results["data"]] == [
            [{"count": 1}],
            [{"count": 0}],
        ]

        results = data["0"]
        assert [attrs for time, attrs in results["data"]] == [
            [{"count": 1}],
            [{"count": 0}],
        ]

    def test_top_events_with_aggregate_condition(self):
        with self.feature("organizations:discover-basic"):
            response = self.client.get(
                self.url,
                data={
                    "start": iso_format(self.day_ago),
                    "end": iso_format(self.day_ago + timedelta(hours=1, minutes=59)),
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
