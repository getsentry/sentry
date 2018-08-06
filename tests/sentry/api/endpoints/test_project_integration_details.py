from __future__ import absolute_import

import six

from sentry.models import Integration, ProjectIntegration
from sentry.testutils import APITestCase


class ProjectIntegrationDetailsTest(APITestCase):
    def setUp(self):
        super(ProjectIntegrationDetailsTest, self).setUp()

        self.login_as(user=self.user)
        self.org = self.create_organization(owner=self.user, name='baz')

        team = self.create_team(organization=self.org, name='Mariachi Band')
        self.project = self.create_project(teams=[team], name='bar-project')

        self.integration = Integration.objects.create(
            provider='example',
            name='Example',
        )
        self.integration.add_organization(self.org.id)

        self.path = '/api/0/projects/{}/{}/integrations/{}/'.format(
            self.org.slug,
            self.project.slug,
            self.integration.id,
        )

    def test_simple(self):
        config = {'setting': 'value'}
        assert self.integration.add_project(self.project.id, config=config)

        response = self.client.get(self.path, format='json')

        assert response.status_code == 200, response.content
        assert response.data['id'] == six.text_type(self.integration.id)
        assert response.data['configData'] == config

    def test_enable(self):
        response = self.client.put(self.path, format='json')
        assert response.status_code == 201, response.content

        assert ProjectIntegration.objects.filter(
            project=self.project,
            integration=self.integration
        ).exists()

        # Object has already been created, 204
        response = self.client.put(self.path, format='json')
        assert response.status_code == 204, response.content

    def test_remove(self):
        assert self.integration.add_project(self.project.id)

        response = self.client.delete(self.path, format='json')
        assert response.status_code == 204, response.content

        assert not ProjectIntegration.objects.filter(
            project=self.project,
            integration=self.integration
        ).exists()

    def test_update_config(self):
        config = {'setting': 'value'}
        assert self.integration.add_project(self.project.id, config=config)

        config = {
            'setting': 'new_value',
            'setting2': 'baz',
        }
        response = self.client.post(self.path, format='json', data=config)

        assert response.status_code == 200, response.content

        project_integration = ProjectIntegration.objects.get(
            project=self.project,
            integration=self.integration,
        )

        assert project_integration.config == config
