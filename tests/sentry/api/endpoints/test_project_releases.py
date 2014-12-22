from __future__ import absolute_import

from datetime import datetime
from django.core.urlresolvers import reverse

from sentry.models import Release
from sentry.testutils import APITestCase


class ProjectReleasesTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        team = self.create_team(owner=self.user)
        project1 = self.create_project(team=team, name='foo')
        project2 = self.create_project(team=team, name='bar')

        release1 = Release.objects.create(
            project=project1,
            version='1',
            date_added=datetime(2013, 8, 13, 3, 8, 24, 880386),
        )
        release2 = Release.objects.create(
            project=project1,
            version='2',
            date_added=datetime(2013, 8, 14, 3, 8, 24, 880386),
        )
        Release.objects.create(
            project=project2,
            version='1',
        )

        url = reverse('sentry-api-0-project-releases', kwargs={
            'project_id': project1.id,
        })
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert len(response.data) == 2
        assert response.data[0]['id'] == str(release2.id)
        assert response.data[1]['id'] == str(release1.id)
