from __future__ import absolute_import

import six

from sentry.models import ExternalIssue, GroupLink, Integration
from sentry.testutils import APITestCase
from sentry.utils.http import absolute_uri


class GroupIntegrationDetailsTest(APITestCase):
    def test_simple_get_link(self):
        self.login_as(user=self.user)
        org = self.organization
        group = self.create_group()
        integration = Integration.objects.create(
            provider='example',
            name='Example',
        )
        integration.add_organization(org.id)

        path = '/api/0/issues/{}/integrations/{}/?action=link'.format(group.id, integration.id)

        response = self.client.get(path)

        assert response.data == {
            'id': six.text_type(integration.id),
            'name': integration.name,
            'icon': integration.metadata.get('icon'),
            'domain_name': integration.metadata.get('domain_name'),
            'provider': {
                'key': integration.get_provider().key,
                'name': integration.get_provider().name,
            },
            'linkIssueConfig': [{
                'default': '',
                'type': 'string',
                'name': 'externalIssue',
                'label': 'Issue',
            }]
        }

    def test_simple_get_create(self):
        self.login_as(user=self.user)
        org = self.organization
        group = self.create_group()
        self.create_event(group=group)
        integration = Integration.objects.create(
            provider='example',
            name='Example',
        )
        integration.add_organization(org.id)

        path = '/api/0/issues/{}/integrations/{}/?action=create'.format(group.id, integration.id)

        response = self.client.get(path)

        assert response.data == {
            'id': six.text_type(integration.id),
            'name': integration.name,
            'icon': integration.metadata.get('icon'),
            'domain_name': integration.metadata.get('domain_name'),
            'provider': {
                'key': integration.get_provider().key,
                'name': integration.get_provider().name,
            },
            'createIssueConfig': [
                {
                    'default': 'message',
                    'type': 'string',
                    'name': 'title',
                    'label': 'Title',
                }, {
                    'default': ('%s\n\n```\n'
                                'Stacktrace (most recent call last):\n\n  '
                                'File "sentry/models/foo.py", line 29, in build_msg\n    '
                                'string_max_length=self.string_max_length)\n\nmessage\n```'
                                ) % (absolute_uri(group.get_absolute_url()),),
                    'type': 'textarea',
                    'name': 'description',
                    'label': 'Description',
                }
            ]
        }

    def test_simple_put(self):
        self.login_as(user=self.user)
        org = self.organization
        group = self.create_group()
        integration = Integration.objects.create(
            provider='example',
            name='Example',
        )
        integration.add_organization(org.id)

        path = '/api/0/issues/{}/integrations/{}/'.format(group.id, integration.id)

        response = self.client.put(path, data={
            'externalIssue': 'APP-123'
        })

        assert response.status_code == 201
        external_issue = ExternalIssue.objects.get(
            key='APP-123',
            integration_id=integration.id,
            organization_id=org.id,
        )
        assert GroupLink.objects.filter(
            linked_type=GroupLink.LinkedType.issue,
            group_id=group.id,
            linked_id=external_issue.id,
        ).exists()
