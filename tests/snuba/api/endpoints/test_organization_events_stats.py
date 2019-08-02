from __future__ import absolute_import

from six.moves.urllib.parse import urlencode

from datetime import timedelta
from django.utils import timezone

from django.core.urlresolvers import reverse

from sentry.testutils import APITestCase, SnubaTestCase


class OrganizationEventsStatsEndpointTest(APITestCase, SnubaTestCase):
    def setUp(self):
        super(OrganizationEventsStatsEndpointTest, self).setUp()
        self.login_as(user=self.user)

        self.day_ago = (timezone.now() - timedelta(days=1)).replace(
            hour=10, minute=0, second=0, microsecond=0
        )

        self.project = self.create_project()
        self.project2 = self.create_project()

        self.group = self.create_group(project=self.project)
        self.group2 = self.create_group(project=self.project2)

        self.user = self.create_user()
        self.user2 = self.create_user()
        self.create_event(
            event_id="a" * 32,
            group=self.group,
            datetime=self.day_ago + timedelta(minutes=1),
            tags={"sentry:user": self.user.email},
        )
        self.create_event(
            event_id="b" * 32,
            group=self.group2,
            datetime=self.day_ago + timedelta(hours=1, minutes=1),
            tags={"sentry:user": self.user2.email},
        )
        self.create_event(
            event_id="c" * 32,
            group=self.group2,
            datetime=self.day_ago + timedelta(hours=1, minutes=2),
            tags={"sentry:user": self.user2.email},
        )

    def test_simple(self):
        url = reverse(
            "sentry-api-0-organization-events-stats",
            kwargs={"organization_slug": self.project.organization.slug},
        )
        response = self.client.get(
            "%s?%s"
            % (
                url,
                urlencode(
                    {
                        "start": self.day_ago.isoformat()[:19],
                        "end": (self.day_ago + timedelta(hours=1, minutes=59)).isoformat()[:19],
                        "interval": "1h",
                    }
                ),
            ),
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
        url = reverse(
            "sentry-api-0-organization-events-stats",
            kwargs={"organization_slug": self.organization.slug},
        )
        url = "%s?%s" % (
            url,
            urlencode(
                {
                    "start": self.day_ago.isoformat()[:19],
                    "end": (self.day_ago + timedelta(hours=1, minutes=59)).isoformat()[:19],
                    "interval": "1h",
                    "group": self.group.id,
                }
            ),
        )
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert len(response.data["data"])

    def test_groupid_filter_invalid_value(self):
        url = reverse(
            "sentry-api-0-organization-events-stats",
            kwargs={"organization_slug": self.organization.slug},
        )
        url = "%s?group=not-a-number" % (url,)
        response = self.client.get(url, format="json")

        assert response.status_code == 400, response.content

    def test_user_count(self):
        self.create_event(
            event_id="d" * 32,
            group=self.group2,
            datetime=self.day_ago + timedelta(minutes=2),
            tags={"sentry:user": self.user2.email},
        )
        url = reverse(
            "sentry-api-0-organization-events-stats",
            kwargs={"organization_slug": self.project.organization.slug},
        )
        response = self.client.get(
            "%s?%s"
            % (
                url,
                urlencode(
                    {
                        "start": self.day_ago.isoformat()[:19],
                        "end": (self.day_ago + timedelta(hours=1, minutes=59)).isoformat()[:19],
                        "interval": "1h",
                        "yAxis": "user_count",
                    }
                ),
            ),
            format="json",
        )

        assert response.status_code == 200, response.content

        assert [attrs for time, attrs in response.data["data"]] == [
            [],
            [{"count": 2}],
            [{"count": 1}],
        ]

    def test_with_event_count_flag(self):
        url = reverse(
            "sentry-api-0-organization-events-stats",
            kwargs={"organization_slug": self.project.organization.slug},
        )
        response = self.client.get(
            "%s?%s"
            % (
                url,
                urlencode(
                    {
                        "start": self.day_ago.isoformat()[:19],
                        "end": (self.day_ago + timedelta(hours=1, minutes=59)).isoformat()[:19],
                        "interval": "1h",
                        "yAxis": "event_count",
                    }
                ),
            ),
            format="json",
        )

        assert response.status_code == 200, response.content
        assert [attrs for time, attrs in response.data["data"]] == [
            [],
            [{"count": 1}],
            [{"count": 2}],
        ]
