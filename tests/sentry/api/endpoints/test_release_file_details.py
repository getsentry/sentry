from __future__ import absolute_import

import six

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
                name='application.js',
                type='release.file',
            ),
            name='http://example.com/application.js'
        )

        url = reverse('sentry-api-0-release-file-details', kwargs={
            'organization_slug': project.organization.slug,
            'project_slug': project.slug,
            'version': release.version,
            'file_id': releasefile.id,
        })

        response = self.client.get(url)

        assert response.status_code == 200, response.content
        assert response.data['id'] == six.text_type(releasefile.id)


class ReleaseFileUpdateTest(APITestCase):
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
                name='application.js',
                type='release.file',
            ),
            name='http://example.com/application.js'
        )

        url = reverse('sentry-api-0-release-file-details', kwargs={
            'organization_slug': project.organization.slug,
            'project_slug': project.slug,
            'version': release.version,
            'file_id': releasefile.id,
        })

        response = self.client.put(url, {
            'name': 'foobar',
        })

        assert response.status_code == 200, response.content
        assert response.data['id'] == six.text_type(releasefile.id)

        releasefile = ReleaseFile.objects.get(id=releasefile.id)
        assert releasefile.name == 'foobar'
        assert releasefile.ident == ReleaseFile.get_ident('foobar')


class ReleaseFileDeleteTest(APITestCase):
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
                name='application.js',
                type='release.file',
            ),
            name='http://example.com/application.js'
        )

        url = reverse('sentry-api-0-release-file-details', kwargs={
            'organization_slug': project.organization.slug,
            'project_slug': project.slug,
            'version': release.version,
            'file_id': releasefile.id,
        })

        response = self.client.delete(url)

        assert response.status_code == 204, response.content

        assert not ReleaseFile.objects.filter(id=releasefile.id).exists()
        assert not File.objects.filter(id=releasefile.file.id).exists()
