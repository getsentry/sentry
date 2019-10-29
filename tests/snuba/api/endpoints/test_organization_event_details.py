from __future__ import absolute_import

from datetime import timedelta

from django.core.urlresolvers import reverse
from sentry.testutils import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import iso_format, before_now
from sentry.models import Group


class OrganizationEventDetailsEndpointTest(APITestCase, SnubaTestCase):
    def setUp(self):
        super(OrganizationEventDetailsEndpointTest, self).setUp()
        min_ago = iso_format(before_now(minutes=1))
        two_min_ago = iso_format(before_now(minutes=2))
        three_min_ago = iso_format(before_now(minutes=3))

        self.login_as(user=self.user)
        self.project = self.create_project()

        self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "oh no",
                "timestamp": three_min_ago,
                "fingerprint": ["group-1"],
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "event_id": "b" * 32,
                "message": "very bad",
                "timestamp": two_min_ago,
                "fingerprint": ["group-1"],
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "event_id": "c" * 32,
                "message": "very bad",
                "timestamp": min_ago,
                "fingerprint": ["group-2"],
            },
            project_id=self.project.id,
        )
        self.groups = list(Group.objects.all().order_by("id"))

    def test_simple(self):
        url = reverse(
            "sentry-api-0-organization-event-details",
            kwargs={
                "organization_slug": self.project.organization.slug,
                "project_slug": self.project.slug,
                "event_id": "a" * 32,
            },
        )

        with self.feature("organizations:events-v2"):
            response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert response.data["id"] == "a" * 32
        assert response.data["previousEventID"] is None
        assert response.data["nextEventID"] == "b" * 32
        assert response.data["projectSlug"] == self.project.slug

    def test_simple_transaction(self):
        min_ago = iso_format(before_now(minutes=1))
        event = self.store_event(
            data={
                "event_id": "d" * 32,
                "type": "transaction",
                "transaction": "api.issue.delete",
                "spans": [],
                "contexts": {"trace": {"op": "foobar", "trace_id": "a" * 32, "span_id": "a" * 16}},
                "start_timestamp": iso_format(before_now(minutes=1, seconds=5)),
                "timestamp": min_ago,
            },
            project_id=self.project.id,
        )
        url = reverse(
            "sentry-api-0-organization-event-details",
            kwargs={
                "organization_slug": self.project.organization.slug,
                "project_slug": self.project.slug,
                "event_id": event.event_id,
            },
        )
        with self.feature("organizations:events-v2"):
            response = self.client.get(url, format="json")
        assert response.status_code == 200

    def test_no_access_missing_feature(self):
        url = reverse(
            "sentry-api-0-organization-event-details",
            kwargs={
                "organization_slug": self.project.organization.slug,
                "project_slug": self.project.slug,
                "event_id": "a" * 32,
            },
        )

        response = self.client.get(url, format="json")
        assert response.status_code == 404, response.content

    def test_access_non_member_project(self):
        # Add a new user to a project and then access events on project they are not part of.
        member_user = self.create_user()
        team = self.create_team(members=[member_user])
        self.create_project(organization=self.organization, teams=[team])

        # Enable open membership
        self.organization.flags.allow_joinleave = True
        self.organization.save()

        self.login_as(member_user)

        url = reverse(
            "sentry-api-0-organization-event-details",
            kwargs={
                "organization_slug": self.organization.slug,
                "project_slug": self.project.slug,
                "event_id": "a" * 32,
            },
        )
        with self.feature("organizations:events-v2"):
            response = self.client.get(url, format="json")
        assert response.status_code == 200, response.content

        # When open membership is off, access should be denied to non owner users
        self.organization.flags.allow_joinleave = False
        self.organization.save()

        with self.feature("organizations:events-v2"):
            response = self.client.get(url, format="json")
        assert response.status_code == 404, response.content

    def test_no_event(self):
        url = reverse(
            "sentry-api-0-organization-event-details",
            kwargs={
                "organization_slug": self.project.organization.slug,
                "project_slug": self.project.slug,
                "event_id": "d" * 32,
            },
        )

        with self.feature("organizations:events-v2"):
            response = self.client.get(url, format="json")

        assert response.status_code == 404, response.content

    def test_event_links_with_field_parameter(self):
        # Create older and newer events
        ten_sec_ago = iso_format(before_now(seconds=10))
        self.store_event(
            data={"event_id": "2" * 32, "message": "no match", "timestamp": ten_sec_ago},
            project_id=self.project.id,
        )
        thirty_sec_ago = iso_format(before_now(seconds=30))
        self.store_event(
            data={"event_id": "1" * 32, "message": "very bad", "timestamp": thirty_sec_ago},
            project_id=self.project.id,
        )
        five_min_ago = iso_format(before_now(minutes=5))
        self.store_event(
            data={"event_id": "d" * 32, "message": "very bad", "timestamp": five_min_ago},
            project_id=self.project.id,
        )
        seven_min_ago = iso_format(before_now(minutes=7))
        self.store_event(
            data={"event_id": "e" * 32, "message": "very bad", "timestamp": seven_min_ago},
            project_id=self.project.id,
        )
        eight_min_ago = iso_format(before_now(minutes=8))
        self.store_event(
            data={"event_id": "f" * 32, "message": "no match", "timestamp": eight_min_ago},
            project_id=self.project.id,
        )

        url = reverse(
            "sentry-api-0-organization-event-details",
            kwargs={
                "organization_slug": self.project.organization.slug,
                "project_slug": self.project.slug,
                "event_id": "b" * 32,
            },
        )
        with self.feature("organizations:events-v2"):
            response = self.client.get(url, format="json", data={"field": ["message", "count()"]})
        assert response.data["eventID"] == "b" * 32
        assert response.data["nextEventID"] == "c" * 32, "c is newer & matches message"
        assert response.data["previousEventID"] == "d" * 32, "d is older & matches message"
        assert response.data["oldestEventID"] == "e" * 32, "e is oldest matching message"
        assert response.data["latestEventID"] == "1" * 32, "1 is newest matching message"

    def test_event_links_with_date_range(self):
        # Create older in and out of range events
        ten_day_ago = iso_format(before_now(days=14))
        self.store_event(
            data={"event_id": "3" * 32, "message": "very bad", "timestamp": ten_day_ago},
            project_id=self.project.id,
        )
        seven_min_ago = iso_format(before_now(minutes=7))
        self.store_event(
            data={"event_id": "2" * 32, "message": "very bad", "timestamp": seven_min_ago},
            project_id=self.project.id,
        )

        url = reverse(
            "sentry-api-0-organization-event-details",
            kwargs={
                "organization_slug": self.project.organization.slug,
                "project_slug": self.project.slug,
                "event_id": "b" * 32,
            },
        )
        with self.feature("organizations:events-v2"):
            response = self.client.get(
                url, format="json", data={"field": ["message", "count()"], "statsPeriod": "7d"}
            )
        assert response.data["eventID"] == "b" * 32
        assert response.data["nextEventID"] == "c" * 32, "c is newer & matches message + range"
        assert response.data["previousEventID"] == "2" * 32, "d is older & matches message + range"
        assert response.data["oldestEventID"] == "2" * 32, "3 is outside range, no match"
        assert response.data["latestEventID"] == "c" * 32, "c is newest matching message"

    def test_event_links_with_tag_fields(self):
        # Create events that overlap with other event messages but
        # with different tags
        ten_sec_ago = iso_format(before_now(seconds=10))
        self.store_event(
            data={
                "event_id": "2" * 32,
                "message": "very bad",
                "timestamp": ten_sec_ago,
                "tags": {"important": "yes"},
            },
            project_id=self.project.id,
        )
        thirty_sec_ago = iso_format(before_now(seconds=30))
        self.store_event(
            data={
                "event_id": "1" * 32,
                "message": "very bad",
                "timestamp": thirty_sec_ago,
                "tags": {"important": "yes"},
            },
            project_id=self.project.id,
        )
        five_min_ago = iso_format(before_now(minutes=5))
        self.store_event(
            data={
                "event_id": "d" * 32,
                "message": "very bad",
                "timestamp": five_min_ago,
                "tags": {"important": "no"},
            },
            project_id=self.project.id,
        )

        url = reverse(
            "sentry-api-0-organization-event-details",
            kwargs={
                "organization_slug": self.project.organization.slug,
                "project_slug": self.project.slug,
                "event_id": "1" * 32,
            },
        )
        with self.feature("organizations:events-v2"):
            response = self.client.get(url, format="json", data={"field": ["important", "count()"]})
        assert response.data["eventID"] == "1" * 32
        assert response.data["previousEventID"] is None, "no matching tags"
        assert response.data["oldestEventID"] is None, "no older matching events"
        assert response.data["nextEventID"] == "2" * 32, "2 is older and has matching tags "
        assert response.data["latestEventID"] == "2" * 32, "2 is oldest matching message"

    def test_event_links_with_transaction_events(self):
        prototype = {
            "type": "transaction",
            "transaction": "api.issue.delete",
            "spans": [],
            "contexts": {"trace": {"op": "foobar", "trace_id": "a" * 32, "span_id": "a" * 16}},
            "tags": {"important": "yes"},
        }
        fixtures = (
            ("d" * 32, before_now(minutes=1)),
            ("e" * 32, before_now(minutes=2)),
            ("f" * 32, before_now(minutes=3)),
        )
        for fixture in fixtures:
            data = prototype.copy()
            data["event_id"] = fixture[0]
            data["timestamp"] = iso_format(fixture[1])
            data["start_timestamp"] = iso_format(fixture[1] - timedelta(seconds=5))
            self.store_event(data=data, project_id=self.project.id)

        url = reverse(
            "sentry-api-0-organization-event-details",
            kwargs={
                "organization_slug": self.project.organization.slug,
                "project_slug": self.project.slug,
                "event_id": "e" * 32,
            },
        )
        with self.feature("organizations:events-v2"):
            response = self.client.get(
                url,
                format="json",
                data={"field": ["important", "count()"], "query": "transaction.duration:>2"},
            )
        assert response.status_code == 200
        assert response.data["nextEventID"] == "d" * 32
        assert response.data["previousEventID"] == "f" * 32
