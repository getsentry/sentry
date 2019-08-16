from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.models import ProjectTeam
from sentry.testutils import APITestCase


class ProjectTeamDetailsTest(APITestCase):
    def test_add_team(self):
        project = self.create_project()
        team = self.create_team()
        self.login_as(user=self.user)

        url = reverse(
            "sentry-api-0-project-team-details",
            kwargs={
                "organization_slug": project.organization.slug,
                "project_slug": project.slug,
                "team_slug": team.slug,
            },
        )
        resp = self.client.post(url)
        assert resp.status_code == 201, resp.content
        assert ProjectTeam.objects.filter(project=project, team=team).exists()

    def test_add_team_not_found(self):
        project = self.create_project()
        self.login_as(user=self.user)

        url = reverse(
            "sentry-api-0-project-team-details",
            kwargs={
                "organization_slug": project.organization.slug,
                "project_slug": project.slug,
                "team_slug": "not-a-team",
            },
        )
        resp = self.client.post(url)
        assert resp.status_code == 404

    def test_remove_team(self):
        team = self.create_team(members=[self.user])
        project = self.create_project(teams=[team])
        self.login_as(user=self.user)

        url = reverse(
            "sentry-api-0-project-team-details",
            kwargs={
                "organization_slug": project.organization.slug,
                "project_slug": project.slug,
                "team_slug": team.slug,
            },
        )
        resp = self.client.delete(url)
        assert resp.status_code == 200, resp.content
        assert not ProjectTeam.objects.filter(project=project, team=team).exists()

    def test_remove_team_not_found(self):
        project = self.create_project()
        self.login_as(user=self.user)

        url = reverse(
            "sentry-api-0-project-team-details",
            kwargs={
                "organization_slug": project.organization.slug,
                "project_slug": project.slug,
                "team_slug": "not-a-team",
            },
        )
        resp = self.client.delete(url)
        assert resp.status_code == 404
