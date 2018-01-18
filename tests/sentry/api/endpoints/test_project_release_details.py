from __future__ import absolute_import

from datetime import datetime
from django.core.urlresolvers import reverse

from sentry.models import (Activity, File, Release, ReleaseCommit, ReleaseFile, ReleaseProject)
from sentry.testutils import APITestCase


class ReleaseDetailsTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        project = self.create_project(name='foo')
        project2 = self.create_project(name='bar', organization=project.organization)

        release = Release.objects.create(
            organization_id=project.organization_id,
            version='1',
        )
        release.add_project(project)
        release.add_project(project2)

        ReleaseProject.objects.filter(project=project, release=release).update(new_groups=5)

        url = reverse(
            'sentry-api-0-project-release-details',
            kwargs={
                'organization_slug': project.organization.slug,
                'project_slug': project.slug,
                'version': release.version,
            }
        )
        response = self.client.get(url)

        assert response.status_code == 200, response.content
        assert response.data['version'] == release.version
        assert response.data['newGroups'] == 5


class UpdateReleaseDetailsTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        project = self.create_project(name='foo')
        project2 = self.create_project(name='bar', organization=project.organization)

        release = Release.objects.create(
            organization_id=project.organization_id,
            version='1',
        )
        release.add_project(project)
        release.add_project(project2)

        url = reverse(
            'sentry-api-0-project-release-details',
            kwargs={
                'organization_slug': project.organization.slug,
                'project_slug': project.slug,
                'version': release.version,
            }
        )
        response = self.client.put(url, {'ref': 'master'})

        assert response.status_code == 200, response.content
        assert response.data['version'] == release.version

        release = Release.objects.get(id=release.id)
        assert release.ref == 'master'

    def test_commits(self):
        self.login_as(user=self.user)

        project = self.create_project(name='foo')
        project2 = self.create_project(name='bar', organization=project.organization)

        release = Release.objects.create(
            organization_id=project.organization_id,
            version='1',
        )
        release.add_project(project)
        release.add_project(project2)

        url = reverse(
            'sentry-api-0-project-release-details',
            kwargs={
                'organization_slug': project.organization.slug,
                'project_slug': project.slug,
                'version': release.version,
            }
        )
        response = self.client.put(
            url, data={
                'commits': [
                    {
                        'id': 'a' * 40
                    },
                    {
                        'id': 'b' * 40
                    },
                ],
            }
        )

        assert response.status_code == 200, (response.status_code, response.content)

        rc_list = list(
            ReleaseCommit.objects.filter(
                release=release,
            ).select_related('commit', 'commit__author').order_by('order')
        )
        assert len(rc_list) == 2
        for rc in rc_list:
            assert rc.organization_id

    def test_activity_generation(self):
        self.login_as(user=self.user)

        project = self.create_project(name='foo')
        project2 = self.create_project(name='bar', organization=project.organization)

        release = Release.objects.create(
            organization_id=project.organization_id,
            version='1',
        )
        release.add_project(project)
        release.add_project(project2)

        url = reverse(
            'sentry-api-0-project-release-details',
            kwargs={
                'organization_slug': project.organization.slug,
                'project_slug': project.slug,
                'version': release.version,
            }
        )
        response = self.client.put(
            url, data={
                'dateReleased': datetime.utcnow().isoformat() + 'Z',
            }
        )

        assert response.status_code == 200, (response.status_code, response.content)

        release = Release.objects.get(id=release.id)
        assert release.date_released

        activity = Activity.objects.filter(
            type=Activity.RELEASE,
            project=project,
            ident=release.version,
        )
        assert activity.exists()

    def test_activity_generation_long_version(self):
        self.login_as(user=self.user)

        project = self.create_project(name='foo')
        project2 = self.create_project(name='bar', organization=project.organization)

        release = Release.objects.create(
            organization_id=project.organization_id,
            version='x' * 65,
        )
        release.add_project(project)
        release.add_project(project2)

        url = reverse(
            'sentry-api-0-project-release-details',
            kwargs={
                'organization_slug': project.organization.slug,
                'project_slug': project.slug,
                'version': release.version,
            }
        )
        response = self.client.put(
            url, data={
                'dateReleased': datetime.utcnow().isoformat() + 'Z',
            }
        )

        assert response.status_code == 200, (response.status_code, response.content)

        release = Release.objects.get(id=release.id)
        assert release.date_released

        activity = Activity.objects.filter(
            type=Activity.RELEASE,
            project=project,
            ident=release.version[:64],
        )
        assert activity.exists()


class ReleaseDeleteTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        project = self.create_project(name='foo')
        project2 = self.create_project(name='bar', organization=project.organization)
        release = Release.objects.create(
            organization_id=project.organization_id,
            version='1',
        )
        release.add_project(project)
        release.add_project(project2)
        ReleaseFile.objects.create(
            organization_id=project.organization_id,
            release=release,
            file=File.objects.create(
                name='application.js',
                type='release.file',
            ),
            name='http://example.com/application.js'
        )

        url = reverse(
            'sentry-api-0-project-release-details',
            kwargs={
                'organization_slug': project.organization.slug,
                'project_slug': project.slug,
                'version': release.version,
            }
        )
        response = self.client.delete(url)

        assert response.status_code == 204, response.content

        assert not Release.objects.filter(id=release.id).exists()

    def test_existing_group(self):
        self.login_as(user=self.user)

        project = self.create_project(name='foo')
        project2 = self.create_project(name='baz', organization=project.organization)
        release = Release.objects.create(
            organization_id=project.organization_id,
            version='1',
        )
        release.add_project(project)
        release.add_project(project2)
        self.create_group(first_release=release)

        url = reverse(
            'sentry-api-0-project-release-details',
            kwargs={
                'organization_slug': project.organization.slug,
                'project_slug': project.slug,
                'version': release.version,
            }
        )
        response = self.client.delete(url)

        assert response.status_code == 400, response.content

        assert Release.objects.filter(id=release.id).exists()
