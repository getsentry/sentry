from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.testutils import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now, iso_format


class OrganizationTagsTest(APITestCase, SnubaTestCase):
    def setUp(self):
        super(OrganizationTagsTest, self).setUp()
        self.min_ago = iso_format(before_now(minutes=1))

    def test_simple(self):
        user = self.create_user()
        org = self.create_organization()
        team = self.create_team(organization=org)
        self.create_member(organization=org, user=user, teams=[team])

        self.login_as(user=user)

        project = self.create_project(organization=org, teams=[team])
        self.store_event(
            data={"event_id": "a" * 32, "tags": {"fruit": "apple"}, "timestamp": self.min_ago},
            project_id=project.id,
        )
        self.store_event(
            data={"event_id": "b" * 32, "tags": {"fruit": "orange"}, "timestamp": self.min_ago},
            project_id=project.id,
        )
        self.store_event(
            data={
                "event_id": "c" * 32,
                "tags": {"some_tag": "some_value"},
                "timestamp": self.min_ago,
            },
            project_id=project.id,
        )
        self.store_event(
            data={"event_id": "d" * 32, "tags": {"fruit": "orange"}, "timestamp": self.min_ago},
            project_id=project.id,
        )

        url = reverse("sentry-api-0-organization-tags", kwargs={"organization_slug": org.slug})

        response = self.client.get(url, format="json")
        assert response.status_code == 200, response.content
        data = response.data
        data.sort(key=lambda val: val["totalValues"], reverse=True)
        assert data == [
            {"name": "Level", "key": "level", "totalValues": 4},
            {"name": "Fruit", "key": "fruit", "totalValues": 3},
            {"name": "Some Tag", "key": "some_tag", "totalValues": 1},
        ]

    def test_no_projects(self):
        user = self.create_user()
        org = self.create_organization(owner=user)
        self.login_as(user=user)

        url = reverse("sentry-api-0-organization-tags", kwargs={"organization_slug": org.slug})

        response = self.client.get(url, format="json")
        assert response.status_code == 200, response.content
        assert response.data == []
