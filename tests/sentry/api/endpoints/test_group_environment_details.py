from __future__ import absolute_import, print_function

from sentry.models import Environment, GroupRelease, Release
from sentry.testutils import APITestCase


class GroupEnvironmentDetailsTest(APITestCase):
    def test_no_data_empty_env(self):
        self.login_as(user=self.user)

        group = self.create_group()
        Environment.objects.create(project_id=group.project_id, name='')

        url = '/api/0/issues/{}/environments/none/'.format(group.id)
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert response.data['lastRelease'] is None
        assert response.data['firstRelease'] is None
        assert response.data['environment']['name'] == ''

    def test_no_data_named_env(self):
        self.login_as(user=self.user)

        group = self.create_group()

        Environment.objects.create(
            project_id=group.project_id,
            name='production',
        )

        url = '/api/0/issues/{}/environments/production/'.format(group.id)
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert response.data['lastRelease'] is None
        assert response.data['firstRelease'] is None
        assert response.data['environment']['name'] == 'production'

    def test_with_data_named_env(self):
        self.login_as(user=self.user)

        project = self.create_project()
        group = self.create_group(project=project)
        Environment.objects.create(
            project_id=group.project_id,
            name='production',
        )

        release = Release.objects.create(
            project=project,
            version='abcdef',
        )

        GroupRelease.objects.create(
            release_id=release.id,
            group_id=group.id,
            project_id=project.id,
            environment='production',
        )

        url = '/api/0/issues/{}/environments/production/'.format(group.id)
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert response.data['lastRelease']['release']['version'] == release.version
        assert response.data['firstRelease']['release']['version'] == release.version
        assert response.data['environment']['name'] == 'production'
        assert response.data['environment'].get('stats')

    def test_missing_env(self):
        self.login_as(user=self.user)

        group = self.create_group()
        Environment.objects.create(project_id=group.project_id, name='')

        url = '/api/0/issues/{}/environments/doesnotexist/'.format(group.id)
        response = self.client.get(url, format='json')

        assert response.status_code == 404, response.content
