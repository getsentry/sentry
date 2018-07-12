from __future__ import absolute_import

import responses

from sentry.integrations.bitbucket.integration import BitbucketIntegration
from sentry.testutils import APITestCase
from sentry.models import Integration
from .testutils import REPOS


class BitbucketIntegrationTest(APITestCase):
    def setUp(self):
        self.base_url = 'https://api.bitbucket.org'
        self.shared_secret = '234567890'
        self.subject = 'connect:1234567'
        self.integration_model = Integration.objects.create(
            provider='bitbucket',
            external_id=self.subject,
            name='sentrytester',
            metadata={
                'base_url': self.base_url,
                'shared_secret': self.shared_secret,
                'subject': self.subject,
            }
        )
        self.integration = BitbucketIntegration(self.integration_model)
        self.integration_model.add_organization(self.organization.id)
        self.integration.project_integration = self.integration_model.add_project(self.project.id)

        self.repos = [
            (u'{1234567890}', u'sentrytester/testtheweb'),
            (u'{0987654321}', u'sentrytester/webthetest')
        ]
        responses.add(
            responses.GET,
            'https://api.bitbucket.org/2.0/repositories/sentrytester',
            body=REPOS,
        )

    @responses.activate
    def test_get_project_config(self):
        fields = self.integration.get_project_config()
        assert len(fields) == 1
        repo_field = fields[0]
        assert repo_field['name'] == 'default_repo'
        assert repo_field['disabled'] is False
        assert repo_field['choices'] == self.repos
        assert repo_field['initial'] == ('', '')

    @responses.activate
    def test_get_project_config_initial(self):
        self.integration.project_integration.config = {'default_repo': self.repos[1][0]}
        self.integration.project_integration.save()
        fields = self.integration.get_project_config()
        assert len(fields) == 1
        repo_field = fields[0]
        assert repo_field['name'] == 'default_repo'
        assert repo_field['disabled'] is False
        assert repo_field['choices'] == self.repos
        assert repo_field['initial'] == self.repos[1]
