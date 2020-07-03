from __future__ import absolute_import

import six

from django.core.urlresolvers import reverse

from sentry.models import Project
from sentry.testutils import APITestCase
from sentry.utils.compat import map


class TeamProjectIndexTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)
        team = self.create_team(members=[self.user])
        project_1 = self.create_project(teams=[team], slug="fiz")
        project_2 = self.create_project(teams=[team], slug="buzz")

        url = reverse(
            "sentry-api-0-team-project-index",
            kwargs={"organization_slug": team.organization.slug, "team_slug": team.slug},
        )
        response = self.client.get(url)
        assert response.status_code == 200
        assert len(response.data) == 2
        assert sorted(map(lambda x: x["id"], response.data)) == sorted(
            [six.text_type(project_1.id), six.text_type(project_2.id)]
        )


class TeamProjectCreateTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)
        team = self.create_team(members=[self.user])
        url = reverse(
            "sentry-api-0-team-project-index",
            kwargs={"organization_slug": team.organization.slug, "team_slug": team.slug},
        )
        resp = self.client.post(url, data={"name": "hello world", "slug": "foobar"})
        assert resp.status_code == 201, resp.content
        project = Project.objects.get(id=resp.data["id"])
        assert project.name == "hello world"
        assert project.slug == "foobar"
        assert project.teams.first() == team

        resp = self.client.post(url, data={"name": "hello world", "slug": "foobar"})
        assert resp.status_code == 409, resp.content
