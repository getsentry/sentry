from __future__ import absolute_import

from django.core.urlresolvers import reverse
from sentry.testutils import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import iso_format, before_now
from sentry.models import Group


class OrganizationEventDetailsTestBase(APITestCase, SnubaTestCase):
    def setUp(self):
        super(OrganizationEventDetailsTestBase, self).setUp()
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


class OrganizationEventDetailsEndpointTest(OrganizationEventDetailsTestBase):
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

    def test_no_access(self):
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


class OrganizationEventDetailsLatestEndpointTest(OrganizationEventDetailsTestBase):
    def test_simple(self):
        url = reverse(
            "sentry-api-0-organization-event-details-latest",
            kwargs={"organization_slug": self.project.organization.slug},
        )

        with self.feature("organizations:events-v2"):
            response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert response.data["id"] == "c" * 32
        assert response.data["previousEventID"] == "b" * 32
        assert response.data["nextEventID"] is None
        assert response.data["projectSlug"] == self.project.slug

    def test_no_access(self):
        url = reverse(
            "sentry-api-0-organization-event-details-latest",
            kwargs={"organization_slug": self.project.organization.slug},
        )

        response = self.client.get(url, format="json")

        assert response.status_code == 404, response.content

    def test_no_event(self):
        new_org = self.create_organization(owner=self.user)
        self.create_project(organization=new_org)
        url = reverse(
            "sentry-api-0-organization-event-details-latest",
            kwargs={"organization_slug": new_org.slug},
        )

        with self.feature("organizations:events-v2"):
            response = self.client.get(url, format="json")

        assert response.status_code == 404, response.content

    def test_query_with_issue_id(self):
        url = reverse(
            "sentry-api-0-organization-event-details-latest",
            kwargs={"organization_slug": self.project.organization.slug},
        )
        query = {"query": "issue.id:{}".format(self.groups[1].id)}

        with self.feature("organizations:events-v2"):
            response = self.client.get(url, query, format="json")

        assert response.status_code == 200, response.content
        assert response.data["id"] == "c" * 32
        assert response.data["previousEventID"] is None
        assert response.data["nextEventID"] is None
        assert response.data["projectSlug"] == self.project.slug


class OrganizationEventDetailsOldestEndpointTest(OrganizationEventDetailsTestBase):
    def test_simple(self):
        url = reverse(
            "sentry-api-0-organization-event-details-oldest",
            kwargs={"organization_slug": self.project.organization.slug},
        )

        with self.feature("organizations:events-v2"):
            response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert response.data["id"] == "a" * 32
        assert response.data["previousEventID"] is None
        assert response.data["nextEventID"] == "b" * 32
        assert response.data["projectSlug"] == self.project.slug

    def test_no_access(self):
        url = reverse(
            "sentry-api-0-organization-event-details-oldest",
            kwargs={"organization_slug": self.project.organization.slug},
        )

        response = self.client.get(url, format="json")

        assert response.status_code == 404, response.content

    def test_no_event(self):
        new_org = self.create_organization(owner=self.user)
        self.create_project(organization=new_org)
        url = reverse(
            "sentry-api-0-organization-event-details-oldest",
            kwargs={"organization_slug": new_org.slug},
        )

        with self.feature("organizations:events-v2"):
            response = self.client.get(url, format="json")

        assert response.status_code == 404, response.content

    def test_query_with_issue_id(self):
        url = reverse(
            "sentry-api-0-organization-event-details-oldest",
            kwargs={"organization_slug": self.project.organization.slug},
        )
        query = {"query": "issue.id:{}".format(self.groups[1].id)}

        with self.feature("organizations:events-v2"):
            response = self.client.get(url, query, format="json")

        assert response.status_code == 200, response.content
        assert response.data["id"] == "c" * 32
        assert response.data["previousEventID"] is None
        assert response.data["nextEventID"] is None
        assert response.data["projectSlug"] == self.project.slug
