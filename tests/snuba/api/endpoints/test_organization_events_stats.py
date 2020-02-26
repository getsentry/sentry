from __future__ import absolute_import

import six
import uuid
import mock

from datetime import timedelta

from django.core.urlresolvers import reverse

from sentry.testutils import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import iso_format, before_now
from sentry.utils.compat import zip


class OrganizationEventsStatsEndpointTest(APITestCase, SnubaTestCase):
    def setUp(self):
        super(OrganizationEventsStatsEndpointTest, self).setUp()
        self.login_as(user=self.user)

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
                "end": iso_format(self.day_ago + timedelta(hours=1, minutes=59)),
                "interval": "1h",
            },
            format="json",
        )

        assert response.status_code == 200, response.content
        assert [attrs for time, attrs in response.data["data"]] == [
            [],
            [{"count": 1}],
            [{"count": 2}],
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
        assert [attrs for time, attrs in response.data["data"]] == [
            [],
            [{"count": 2}],
            [{"count": 1}],
        ]

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
        assert [attrs for time, attrs in response.data["data"]] == [
            [],
            [{"count": 1}],
            [{"count": 2}],
        ]

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
        assert [attrs for time, attrs in response.data["data"]] == [
            [],
            [{"count": 1}],
            [{"count": 2}],
        ]

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
        assert [attrs for time, attrs in response.data["data"]] == [
            [],
            [{"count": 1}],
            [{"count": 1}],
        ]

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

    def test_throughput_rpm_hour_rollup(self):
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
                    "yAxis": "rpm()",
                    "project": project.id,
                },
            )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 8

        rows = data[1:7]
        for test in zip(event_counts, rows):
            assert test[1][1][0]["count"] == test[0] / (3600.0 / 60.0)

    def test_throughput_rpm_day_rollup(self):
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
                    "yAxis": "rpm()",
                    "project": project.id,
                },
            )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 2
        assert data[1][1][0]["count"] == sum(event_counts) / (86400.0 / 60.0)

    def test_throughput_rps_minute_rollup(self):
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
                    "yAxis": "rps()",
                    "project": project.id,
                },
            )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 8

        rows = data[1:7]
        for test in zip(event_counts, rows):
            assert test[1][1][0]["count"] == test[0] / 60.0

    def test_throughput_rps_no_rollup(self):
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
                    "yAxis": "rps()",
                    "project": project.id,
                },
            )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 62

        rows = data[1:7]
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
        assert [attrs for time, attrs in response.data["data"]] == [
            [],
            [{"count": 2}],
            [{"count": 2}],
        ]

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
        assert [attrs for time, attrs in response.data["data"]] == [
            [],
            [{"count": 1}],
            [{"count": 1}],
        ]

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
        assert [attrs for time, attrs in response.data["user_count"]["data"]] == [
            [],
            [{"count": 1}],
            [{"count": 1}],
        ]
        assert [attrs for time, attrs in response.data["event_count"]["data"]] == [
            [],
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
                    "yAxis": ["user_count", "event_count", "rpm()", "rps()"],
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
