from __future__ import absolute_import

import functools
import sys

from django.core.urlresolvers import reverse

from sentry import tsdb
from sentry.testutils import APITestCase


class OrganizationStatsTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        org = self.create_organization(owner=self.user)

        tsdb.incr(tsdb.models.organization_total_received, org.id, count=3)

        url = reverse("sentry-api-0-organization-stats", args=[org.slug])
        response = self.client.get(url)

        assert response.status_code == 200, response.content
        assert response.data[-1][1] == 3, response.data
        for point in response.data[:-1]:
            assert point[1] == 0
        assert len(response.data) == 24

    def test_resolution(self):
        self.login_as(user=self.user)

        org = self.create_organization(owner=self.user)

        tsdb.incr(tsdb.models.organization_total_received, org.id, count=3)

        url = reverse("sentry-api-0-organization-stats", args=[org.slug])
        response = self.client.get(u"{}?resolution=1d".format(url))

        assert response.status_code == 200, response.content
        assert response.data[-1][1] == 3, response.data
        assert len(response.data) == 1

    def test_id_filtering(self):
        self.login_as(user=self.user)

        org = self.create_organization(owner=self.user)
        project = self.create_project(
            teams=[self.create_team(organization=org, members=[self.user])]
        )

        make_request = functools.partial(
            self.client.get, reverse("sentry-api-0-organization-stats", args=[org.slug])
        )

        response = make_request({"id": [project.id], "group": "project"})

        assert response.status_code == 200, response.content
        assert project.id in response.data

        response = make_request({"id": [sys.maxsize], "group": "project"})

        assert project.id not in response.data

    def test_project_id_only(self):
        self.login_as(user=self.user)

        org = self.create_organization(owner=self.user)
        project = self.create_project(
            teams=[self.create_team(organization=org, members=[self.user])]
        )
        project2 = self.create_project(
            teams=[self.create_team(organization=org, members=[self.user])]
        )

        make_request = functools.partial(
            self.client.get, reverse("sentry-api-0-organization-stats", args=[org.slug])
        )

        response = make_request({"projectID": [project.id], "group": "project"})

        assert response.status_code == 200, response.content
        assert project.id in response.data
        assert project2.id not in response.data
