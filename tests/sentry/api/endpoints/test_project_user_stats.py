from __future__ import absolute_import

from django.core.urlresolvers import reverse
from django.utils import timezone

from sentry import tsdb
from sentry.models import EventUser
from sentry.testutils import APITestCase


class ProjectUserDetailsTest(APITestCase):
    def setUp(self):
        super(ProjectUserDetailsTest, self).setUp()
        self.user = self.create_user()
        self.org = self.create_organization(owner=None)
        self.team = self.create_team(organization=self.org)
        self.project = self.create_project(organization=self.org, teams=[self.team])
        self.create_member(user=self.user, organization=self.org, teams=[self.team])

        self.login_as(user=self.user)

        self.path = reverse(
            "sentry-api-0-project-userstats", args=[self.org.slug, self.project.slug]
        )

    def test_simple(self):
        euser1 = EventUser.objects.create(email="foo@example.com", project_id=self.project.id)
        euser2 = EventUser.objects.create(email="bar@example.com", project_id=self.project.id)
        tsdb.record_multi(
            (
                (tsdb.models.users_affected_by_project, self.project.id, (euser2.tag_value,)),
                (tsdb.models.users_affected_by_project, self.project.id, (euser1.tag_value,)),
            ),
            timestamp=timezone.now(),
        )

        response = self.client.get(self.path)

        assert response.status_code == 200, response.content
        assert response.data[-1][1] == 2, response.data
        for point in response.data[:-1]:
            assert point[1] == 0
        assert len(response.data) == 31
