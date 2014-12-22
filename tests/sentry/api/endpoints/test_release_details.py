from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.models import Release
from sentry.testutils import APITestCase


class ReleaseDetailsTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        project = self.create_project(name='foo')
        release = Release.objects.create(
            project=project,
            version='1',
        )

        url = reverse('sentry-api-0-release-details', kwargs={
            'release_id': release.id,
        })
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert response.data['id'] == str(release.id)
