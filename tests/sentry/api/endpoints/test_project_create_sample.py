from __future__ import absolute_import

from django.core.urlresolvers import reverse
import json
from mock import patch

from sentry.constants import INTEGRATION_ID_TO_PLATFORM_DATA
from sentry.testutils import APITestCase


class ProjectCreateSampleTest(APITestCase):
    mock_integration_ids = {
        'java': {},
        'java-log4j': {},
        'java-log4j2': {},
        'java-android': {},
        'javascript': {
            'name': 'JavaScript',
            'type': 'language'
        },
        'javascript-react': {
            'name': 'React',
            'type': 'framework',
            'language': 'javascript'
        }
    }

    def test_simple(self):
        with patch.dict(INTEGRATION_ID_TO_PLATFORM_DATA, self.mock_integration_ids):
            self.login_as(user=self.user)
            team = self.create_team()
            project = self.create_project(team=team, name='foo')

            url = reverse(
                'sentry-api-0-project-create-sample',
                kwargs={
                    'organization_slug': project.organization.slug,
                    'project_slug': project.slug,
                }
            )
            response = self.client.post(url, format='json')

            assert response.status_code == 200, response.content
            assert 'groupID' in json.loads(response.content)

    def test_project_platform(self):
        with patch.dict(INTEGRATION_ID_TO_PLATFORM_DATA, self.mock_integration_ids):
            self.login_as(user=self.user)
            team = self.create_team()
            project = self.create_project(team=team, name='foo', platform='javascript-react')

            url = reverse(
                'sentry-api-0-project-create-sample',
                kwargs={
                    'organization_slug': project.organization.slug,
                    'project_slug': project.slug,
                }
            )
            response = self.client.post(url, format='json')

            assert response.status_code == 200, response.content
            assert 'groupID' in json.loads(response.content)
