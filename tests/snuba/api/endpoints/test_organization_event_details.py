from __future__ import absolute_import

from datetime import timedelta

from django.core.urlresolvers import reverse
from sentry.utils.samples import load_data
from sentry.testutils import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import iso_format, before_now
from sentry.models import Group


def format_project_event(project_slug, event_id):
    return "{}:{}".format(project_slug, event_id)


class OrganizationEventDetailsEndpointTest(APITestCase, SnubaTestCase):
    def setUp(self):
        super(OrganizationEventDetailsEndpointTest, self).setUp()
        min_ago = iso_format(before_now(minutes=1))
        two_min_ago = iso_format(before_now(minutes=2))
        three_min_ago = iso_format(before_now(minutes=3))

        self.login_as(user=self.user)
        self.project = self.create_project()
        self.project_2 = self.create_project()

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

    def test_performance_flag(self):
        url = reverse(
            "sentry-api-0-organization-event-details",
            kwargs={
                "organization_slug": self.project.organization.slug,
                "project_slug": self.project.slug,
                "event_id": "a" * 32,
            },
        )
        with self.feature(
            {"organizations:discover-basic": False, "organizations:performance-view": True}
        ):
            response = self.client.get(url, format="json")
        assert response.status_code == 200, response.content
        assert response.data["id"] == "a" * 32
        assert response.data["projectSlug"] == self.project.slug

    def test_simple(self):
        url = reverse(
            "sentry-api-0-organization-event-details",
            kwargs={
                "organization_slug": self.project.organization.slug,
                "project_slug": self.project.slug,
                "event_id": "a" * 32,
            },
        )

        with self.feature("organizations:discover-basic"):
            response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert response.data["id"] == "a" * 32
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
        with self.feature("organizations:discover-basic"):
            response = self.client.get(url, format="json")
        assert response.status_code == 200
        assert response.data["id"] == "d" * 32
        assert response.data["type"] == "transaction"

    def test_no_access_missing_feature(self):
        with self.feature({"organizations:discover-basic": False}):
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
        with self.feature("organizations:discover-basic"):
            response = self.client.get(url, format="json")
        assert response.status_code == 200, response.content

        # When open membership is off, access should be denied to non owner users
        self.organization.flags.allow_joinleave = False
        self.organization.save()

        with self.feature("organizations:discover-basic"):
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

        with self.feature("organizations:discover-basic"):
            response = self.client.get(url, format="json")

        assert response.status_code == 404, response.content

    def test_long_trace_description(self):
        data = load_data("transaction")
        data["event_id"] = "d" * 32
        data["timestamp"] = iso_format(before_now(minutes=1))
        data["start_timestamp"] = iso_format(before_now(minutes=1) - timedelta(seconds=5))
        data["contexts"]["trace"]["description"] = "b" * 512
        self.store_event(data=data, project_id=self.project.id)

        url = reverse(
            "sentry-api-0-organization-event-details",
            kwargs={
                "organization_slug": self.project.organization.slug,
                "project_slug": self.project.slug,
                "event_id": "d" * 32,
            },
        )
        with self.feature("organizations:discover-basic"):
            response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        trace = response.data["contexts"]["trace"]
        original_trace = data["contexts"]["trace"]
        assert trace["trace_id"] == original_trace["trace_id"]
        assert trace["span_id"] == original_trace["span_id"]
        assert trace["parent_span_id"] == original_trace["parent_span_id"]
        assert trace["description"][:-3] in original_trace["description"]

    def test_blank_fields(self):
        url = reverse(
            "sentry-api-0-organization-event-details",
            kwargs={
                "organization_slug": self.project.organization.slug,
                "project_slug": self.project.slug,
                "event_id": "a" * 32,
            },
        )

        with self.feature("organizations:discover-basic"):
            response = self.client.get(
                url, data={"field": ["", " "], "statsPeriod": "24h"}, format="json",
            )

        assert response.status_code == 200, response.content
        assert response.data["id"] == "a" * 32
        assert response.data["projectSlug"] == self.project.slug
