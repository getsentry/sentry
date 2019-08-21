from __future__ import absolute_import

from datetime import timedelta

from django.core.urlresolvers import reverse

from sentry.testutils import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import iso_format, before_now


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
        with self.feature("organizations:events-v2"):
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

    def test_aggregate_function_user_count(self):
        with self.feature("organizations:events-v2"):
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
        with self.feature("organizations:events-v2"):
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

    def test_with_field_and_reference_event_invalid(self):
        with self.feature("organizations:events-v2"):
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
        with self.feature("organizations:events-v2"):
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
        with self.feature("organizations:events-v2"):
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
