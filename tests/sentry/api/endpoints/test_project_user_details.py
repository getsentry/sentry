from __future__ import absolute_import

import six

from django.core.urlresolvers import reverse

from sentry.models import EventUser
from sentry.testutils import APITestCase


class ProjectUserDetailsTest(APITestCase):
    def setUp(self):
        super(ProjectUserDetailsTest, self).setUp()
        self.user = self.create_user()
        self.org = self.create_organization(owner=None)
        self.team = self.create_team(organization=self.org)
        self.project = self.create_project(organization=self.org, teams=[self.team])
        self.create_member(
            user=self.user, organization=self.org, teams=[self.project.teams.first()]
        )
        self.euser = EventUser.objects.create(email="foo@example.com", project_id=self.project.id)

        self.login_as(user=self.user)

        self.path = reverse(
            "sentry-api-0-project-user-details",
            args=[self.org.slug, self.project.slug, self.euser.hash],
        )

    def test_simple(self):
        response = self.client.get(self.path)
        assert response.status_code == 200
        assert response.data["id"] == six.text_type(self.euser.id)
