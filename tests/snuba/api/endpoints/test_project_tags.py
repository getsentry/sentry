from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.testutils import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now, iso_format


class ProjectTagsTest(APITestCase, SnubaTestCase):
    def test_simple(self):
        user = self.create_user()
        org = self.create_organization()
        team = self.create_team(organization=org)
        self.create_member(organization=org, user=user, teams=[team])

        project = self.create_project(organization=org, teams=[team])
        self.store_event(
            data={
                "tags": {"foo": "oof", "bar": "rab"},
                "timestamp": iso_format(before_now(minutes=1)),
            },
            project_id=project.id,
        )
        self.store_event(
            data={"tags": {"bar": "rab2"}, "timestamp": iso_format(before_now(minutes=1))},
            project_id=project.id,
        )

        self.login_as(user=user)

        url = reverse(
            "sentry-api-0-project-tags",
            kwargs={"organization_slug": project.organization.slug, "project_slug": project.slug},
        )
        response = self.client.get(url, format="json")
        assert response.status_code == 200, response.content
        data = {v["key"]: v for v in response.data}
        assert len(data) == 3

        assert data["foo"]["canDelete"]
        assert data["foo"]["uniqueValues"] == 1
        assert data["bar"]["canDelete"]
        assert data["bar"]["uniqueValues"] == 2
