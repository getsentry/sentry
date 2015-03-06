from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.models import File, Release, ReleaseFile
from sentry.testutils import APITestCase


class ReleaseFileDetailsTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        project = self.create_project(name='foo')

        release = Release.objects.create(
            project=project,
            version='1',
        )

        releasefile = ReleaseFile.objects.create(
            project=project,
            release=release,
            file=File.objects.create(
                path='http://example.com',
                name='application.js',
                type='source',
            ),
            name='http://example.com/application.js'
        )

        url = reverse('sentry-api-0-release-file-details', kwargs={
            'project_id': project.id,
            'version': release.version,
            'file_id': releasefile.id,
        })

        response = self.client.get(url)

        assert response.status_code == 200, response.content
        assert response.data['id'] == str(releasefile.id)
