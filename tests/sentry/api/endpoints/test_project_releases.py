from __future__ import absolute_import

from datetime import datetime
from django.core.urlresolvers import reverse

from sentry.models import Environment, Release, ReleaseCommit, ReleaseEnvironment, ReleaseProject
from sentry.testutils import APITestCase


class ProjectReleaseListTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        team = self.create_team()
        project1 = self.create_project(teams=[team], name='foo')
        project2 = self.create_project(teams=[team], name='bar')

        release1 = Release.objects.create(
            organization_id=project1.organization_id,
            version='1',
            date_added=datetime(2013, 8, 13, 3, 8, 24, 880386),
        )
        release1.add_project(project1)
        ReleaseProject.objects.filter(project=project1, release=release1).update(new_groups=5)

        release2 = Release.objects.create(
            organization_id=project1.organization_id,
            version='2',
            date_added=datetime(2013, 8, 14, 3, 8, 24, 880386),
        )
        release2.add_project(project1)

        release3 = Release.objects.create(
            organization_id=project1.organization_id,
            version='3',
            date_added=datetime(2013, 8, 12, 3, 8, 24, 880386),
            date_released=datetime(2013, 8, 15, 3, 8, 24, 880386),
        )
        release3.add_project(project1)

        release4 = Release.objects.create(
            organization_id=project2.organization_id,
            version='4',
        )
        release4.add_project(project2)

        url = reverse(
            'sentry-api-0-project-releases',
            kwargs={
                'organization_slug': project1.organization.slug,
                'project_slug': project1.slug,
            }
        )
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert len(response.data) == 3
        assert response.data[0]['version'] == release3.version
        assert response.data[1]['version'] == release2.version
        assert response.data[2]['version'] == release1.version
        assert response.data[2]['newGroups'] == 5

    def test_query_filter(self):
        self.login_as(user=self.user)

        team = self.create_team()
        project = self.create_project(teams=[team], name='foo')

        release = Release.objects.create(
            organization_id=project.organization_id,
            version='foobar',
            date_added=datetime(2013, 8, 13, 3, 8, 24, 880386),
        )
        release.add_project(project)

        url = reverse(
            'sentry-api-0-project-releases',
            kwargs={
                'organization_slug': project.organization.slug,
                'project_slug': project.slug,
            }
        )
        response = self.client.get(url + '?query=foo', format='json')

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]['version'] == release.version

        response = self.client.get(url + '?query=bar', format='json')

        assert response.status_code == 200, response.content
        assert len(response.data) == 0


class ProjectReleaseListEnvironmentsTest(APITestCase):
    def setUp(self):
        self.login_as(user=self.user)

        team = self.create_team()
        project1 = self.create_project(teams=[team], name='foo')
        project2 = self.create_project(teams=[team], name='bar')

        env1 = self.make_environment('prod', project1)
        env2 = self.make_environment('staging', project2)
        env3 = self.make_environment('test', project1)

        release1 = Release.objects.create(
            organization_id=project1.organization_id,
            version='1',
            date_added=datetime(2013, 8, 13, 3, 8, 24, 880386),
        )
        release1.add_project(project1)
        ReleaseEnvironment.objects.create(
            organization_id=project1.organization_id,
            project_id=project1.id,
            release_id=release1.id,
            environment_id=env1.id,
        )

        release2 = Release.objects.create(
            organization_id=project2.organization_id,
            version='2',
            date_added=datetime(2013, 8, 14, 3, 8, 24, 880386),
        )
        release2.add_project(project2)
        ReleaseEnvironment.objects.create(
            organization_id=project2.organization_id,
            project_id=project2.id,
            release_id=release2.id,
            environment_id=env2.id,
        )

        release3 = Release.objects.create(
            organization_id=project1.organization_id,
            version='3',
            date_added=datetime(2013, 8, 12, 3, 8, 24, 880386),
            date_released=datetime(2013, 8, 15, 3, 8, 24, 880386),
        )
        release3.add_project(project1)
        ReleaseEnvironment.objects.create(
            organization_id=project1.organization_id,
            project_id=project1.id,
            release_id=release3.id,
            environment_id=env3.id,
        )

        release4 = Release.objects.create(
            organization_id=project2.organization_id,
            version='4',
        )
        release4.add_project(project2)

        self.project1 = project1
        self.project2 = project2

        self.release1 = release1
        self.release2 = release2
        self.release3 = release3
        self.release4 = release4

        self.env1 = env1
        self.env2 = env2
        self.env3 = env3

    def make_environment(self, name, project):
        env = Environment.objects.create(
            project_id=project.id,
            organization_id=project.organization_id,
            name=name,
        )
        env.add_project(project)
        return env

    def assert_releases(self, response, releases):
        assert response.status_code == 200, response.content
        assert len(response.data) == len(releases)

        response_versions = sorted([r['version'] for r in response.data])
        releases_versions = sorted([r.version for r in releases])
        assert response_versions == releases_versions

    def test_environments_filter(self):
        url = reverse(
            'sentry-api-0-project-releases',
            kwargs={
                'organization_slug': self.project1.organization.slug,
                'project_slug': self.project1.slug,
            }
        )
        response = self.client.get(url + '?environment=' + self.env1.name, format='json')
        self.assert_releases(response, [self.release1])

        response = self.client.get(url + '?environment=' + self.env2.name, format='json')
        self.assert_releases(response, [])

        response = self.client.get(url + '?environment=' + self.env3.name, format='json')
        self.assert_releases(response, [self.release3])
        url = reverse(
            'sentry-api-0-project-releases',
            kwargs={
                'organization_slug': self.project2.organization.slug,
                'project_slug': self.project2.slug,
            }
        )
        response = self.client.get(url + '?environment=' + self.env2.name, format='json')
        self.assert_releases(response, [self.release2])

    def test_empty_environment(self):
        url = reverse(
            'sentry-api-0-project-releases',
            kwargs={
                'organization_slug': self.project2.organization.slug,
                'project_slug': self.project2.slug,
            }
        )
        env = self.make_environment('', self.project2)
        ReleaseEnvironment.objects.create(
            organization_id=self.project2.organization_id,
            project_id=self.project2.id,
            release_id=self.release4.id,
            environment_id=env.id,
        )
        response = self.client.get(url + '?environment=', format='json')
        self.assert_releases(response, [self.release4])

    def test_all_environments(self):
        url = reverse(
            'sentry-api-0-project-releases',
            kwargs={
                'organization_slug': self.project1.organization.slug,
                'project_slug': self.project1.slug,
            }
        )
        response = self.client.get(url, format='json')
        self.assert_releases(response, [self.release1, self.release3])

    def test_invalid_environment(self):
        url = reverse(
            'sentry-api-0-project-releases',
            kwargs={
                'organization_slug': self.project1.organization.slug,
                'project_slug': self.project1.slug,
            }
        )
        response = self.client.get(url + '?environment=' + 'invalid_environment', format='json')
        self.assert_releases(response, [])


class ProjectReleaseCreateTest(APITestCase):
    def test_minimal(self):
        self.login_as(user=self.user)

        project = self.create_project(name='foo')

        url = reverse(
            'sentry-api-0-project-releases',
            kwargs={
                'organization_slug': project.organization.slug,
                'project_slug': project.slug,
            }
        )
        response = self.client.post(
            url, data={
                'version': '1.2.1',
            }
        )

        assert response.status_code == 201, response.content
        assert response.data['version']

        release = Release.objects.get(
            version=response.data['version'],
        )
        assert not release.owner
        assert release.organization == project.organization
        assert release.projects.first() == project

    def test_ios_release(self):
        self.login_as(user=self.user)

        project = self.create_project(name='foo')

        url = reverse(
            'sentry-api-0-project-releases',
            kwargs={
                'organization_slug': project.organization.slug,
                'project_slug': project.slug,
            }
        )
        response = self.client.post(
            url, data={
                'version': '1.2.1 (123)',
            }
        )

        assert response.status_code == 201, response.content
        assert response.data['version']

        release = Release.objects.get(
            version=response.data['version'],
        )
        assert not release.owner
        assert release.organization == project.organization
        assert release.projects.first() == project

    def test_duplicate(self):
        self.login_as(user=self.user)

        project = self.create_project(name='foo')

        release = Release.objects.create(version='1.2.1', organization_id=project.organization_id)
        release.add_project(project)

        url = reverse(
            'sentry-api-0-project-releases',
            kwargs={
                'organization_slug': project.organization.slug,
                'project_slug': project.slug,
            }
        )

        response = self.client.post(
            url, data={
                'version': '1.2.1',
            }
        )

        assert response.status_code == 208, response.content

    def test_duplicate_accross_org(self):
        self.login_as(user=self.user)

        project = self.create_project(name='foo')

        release = Release.objects.create(version='1.2.1', organization_id=project.organization_id)
        release.add_project(project)

        project2 = self.create_project(name='bar', organization=project.organization)

        url = reverse(
            'sentry-api-0-project-releases',
            kwargs={
                'organization_slug': project2.organization.slug,
                'project_slug': project2.slug,
            }
        )

        response = self.client.post(
            url, data={
                'version': '1.2.1',
            }
        )

        # since project2 was added, should be 201
        assert response.status_code == 201, response.content
        assert Release.objects.filter(
            version='1.2.1', organization_id=project.organization_id
        ).count() == 1
        assert ReleaseProject.objects.get(release=release, project=project)
        assert ReleaseProject.objects.get(release=release, project=project2)

    def test_version_whitespace(self):
        self.login_as(user=self.user)

        project = self.create_project(name='foo')

        url = reverse(
            'sentry-api-0-project-releases',
            kwargs={
                'organization_slug': project.organization.slug,
                'project_slug': project.slug,
            }
        )

        response = self.client.post(
            url, data={
                'version': '1.2.3\n',
            }
        )
        assert response.status_code == 400, response.content

        response = self.client.post(
            url, data={
                'version': '\n1.2.3',
            }
        )
        assert response.status_code == 400, response.content

        response = self.client.post(
            url, data={
                'version': '1.\n2.3',
            }
        )
        assert response.status_code == 400, response.content

        response = self.client.post(
            url, data={
                'version': '1.2.3\f',
            }
        )
        assert response.status_code == 400, response.content

        response = self.client.post(
            url, data={
                'version': '1.2.3\t',
            }
        )
        assert response.status_code == 400, response.content

        response = self.client.post(
            url, data={
                'version': '1.2.3',
            }
        )
        assert response.status_code == 201, response.content
        assert response.data['version'] == '1.2.3'

        release = Release.objects.get(
            organization_id=project.organization_id,
            version=response.data['version'],
        )
        assert not release.owner

    def test_features(self):
        self.login_as(user=self.user)

        project = self.create_project(name='foo')

        url = reverse(
            'sentry-api-0-project-releases',
            kwargs={
                'organization_slug': project.organization.slug,
                'project_slug': project.slug,
            }
        )
        response = self.client.post(
            url, data={
                'version': '1.2.1',
                'owner': self.user.email,
            }
        )

        assert response.status_code == 201, response.content
        assert response.data['version']

        release = Release.objects.get(
            organization_id=project.organization_id,
            version=response.data['version'],
        )
        assert release.owner == self.user

    def test_commits(self):
        self.login_as(user=self.user)

        project = self.create_project(name='foo')

        url = reverse(
            'sentry-api-0-project-releases',
            kwargs={
                'organization_slug': project.organization.slug,
                'project_slug': project.slug,
            }
        )
        response = self.client.post(
            url, data={'version': '1.2.1',
                       'commits': [
                           {
                               'id': 'a' * 40
                           },
                           {
                               'id': 'b' * 40
                           },
                       ]}
        )

        assert response.status_code == 201, (response.status_code, response.content)
        assert response.data['version']

        release = Release.objects.get(
            organization_id=project.organization_id,
            version=response.data['version'],
        )

        rc_list = list(
            ReleaseCommit.objects.filter(
                release=release,
            ).select_related('commit', 'commit__author').order_by('order')
        )
        assert len(rc_list) == 2
        for rc in rc_list:
            assert rc.organization_id
