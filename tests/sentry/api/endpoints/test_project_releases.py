from __future__ import absolute_import

from datetime import datetime
from django.core.urlresolvers import reverse

from sentry.models import Release, ReleaseCommit
from sentry.testutils import APITestCase


class ProjectReleaseListTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        team = self.create_team()
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
        release3 = Release.objects.create(
            project=project1,
            version='3',
            date_added=datetime(2013, 8, 12, 3, 8, 24, 880386),
            date_released=datetime(2013, 8, 15, 3, 8, 24, 880386),
        )
        Release.objects.create(
            project=project2,
            version='1',
        )

        url = reverse('sentry-api-0-project-releases', kwargs={
            'organization_slug': project1.organization.slug,
            'project_slug': project1.slug,
        })
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert len(response.data) == 3
        assert response.data[0]['version'] == release3.version
        assert response.data[1]['version'] == release2.version
        assert response.data[2]['version'] == release1.version

    def test_query_filter(self):
        self.login_as(user=self.user)

        team = self.create_team()
        project = self.create_project(team=team, name='foo')

        release = Release.objects.create(
            project=project,
            version='foobar',
            date_added=datetime(2013, 8, 13, 3, 8, 24, 880386),
        )

        url = reverse('sentry-api-0-project-releases', kwargs={
            'organization_slug': project.organization.slug,
            'project_slug': project.slug,
        })
        response = self.client.get(url + '?query=foo', format='json')

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]['version'] == release.version

        response = self.client.get(url + '?query=bar', format='json')

        assert response.status_code == 200, response.content
        assert len(response.data) == 0


class ProjectReleaseCreateTest(APITestCase):
    def test_minimal(self):
        self.login_as(user=self.user)

        project = self.create_project(name='foo')

        url = reverse('sentry-api-0-project-releases', kwargs={
            'organization_slug': project.organization.slug,
            'project_slug': project.slug,
        })
        response = self.client.post(url, data={
            'version': '1.2.1',
        })

        assert response.status_code == 201, response.content
        assert response.data['version']

        release = Release.objects.get(
            project=project,
            version=response.data['version'],
        )
        assert not release.owner

    def test_duplicate(self):
        self.login_as(user=self.user)

        project = self.create_project(name='foo')

        Release.objects.create(version='1.2.1', project=project)

        url = reverse('sentry-api-0-project-releases', kwargs={
            'organization_slug': project.organization.slug,
            'project_slug': project.slug,
        })

        response = self.client.post(url, data={
            'version': '1.2.1',
        })

        assert response.status_code == 208, response.content

    def test_version_whitespace(self):
        self.login_as(user=self.user)

        project = self.create_project(name='foo')

        url = reverse('sentry-api-0-project-releases', kwargs={
            'organization_slug': project.organization.slug,
            'project_slug': project.slug,
        })

        response = self.client.post(url, data={
            'version': '1.2.3\n',
        })
        assert response.status_code == 400, response.content

        response = self.client.post(url, data={
            'version': '\n1.2.3',
        })
        assert response.status_code == 400, response.content

        response = self.client.post(url, data={
            'version': '1.\n2.3',
        })
        assert response.status_code == 400, response.content

        response = self.client.post(url, data={
            'version': '1.2.3\f',
        })
        assert response.status_code == 400, response.content

        response = self.client.post(url, data={
            'version': '1.2.3\t',
        })
        assert response.status_code == 400, response.content

        response = self.client.post(url, data={
            'version': '1.2.3',
        })
        assert response.status_code == 201, response.content
        assert response.data['version'] == '1.2.3'

        release = Release.objects.get(
            project=project,
            version=response.data['version'],
        )
        assert not release.owner

    def test_features(self):
        self.login_as(user=self.user)

        project = self.create_project(name='foo')

        url = reverse('sentry-api-0-project-releases', kwargs={
            'organization_slug': project.organization.slug,
            'project_slug': project.slug,
        })
        response = self.client.post(url, data={
            'version': '1.2.1',
            'owner': self.user.email,
        })

        assert response.status_code == 201, response.content
        assert response.data['version']

        release = Release.objects.get(
            project=project,
            version=response.data['version'],
        )
        assert release.owner == self.user

    def test_commits(self):
        self.login_as(user=self.user)

        project = self.create_project(name='foo')

        url = reverse('sentry-api-0-project-releases', kwargs={
            'organization_slug': project.organization.slug,
            'project_slug': project.slug,
        })
        response = self.client.post(url, data={
            'version': '1.2.1',
            'commits': [
                {'id': 'a' * 40},
                {'id': 'b' * 40},
            ]
        })

        assert response.status_code == 201, (response.status_code, response.content)
        assert response.data['version']

        release = Release.objects.get(
            project=project,
            version=response.data['version'],
        )

        rc_list = list(ReleaseCommit.objects.filter(
            release=release,
        ).select_related('commit', 'commit__author').order_by('order'))
        assert len(rc_list) == 2
