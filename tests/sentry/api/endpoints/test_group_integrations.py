from __future__ import absolute_import

import six

from sentry.models import ExternalIssue, GroupLink, Integration
from sentry.testutils import APITestCase


class GroupIntegrationsTest(APITestCase):
    def test_simple_get(self):
        self.login_as(user=self.user)
        org = self.organization
        group = self.create_group()
        integration = Integration.objects.create(
            provider='example',
            name='Example',
        )
        integration.add_organization(org.id)
        external_issue = ExternalIssue.objects.create(
            organization_id=org.id,
            integration_id=integration.id,
            key='APP-123',
            title='this is an example title',
            description='this is an example description',
        )
        GroupLink.objects.create(
            group_id=group.id,
            project_id=group.project_id,
            linked_type=GroupLink.LinkedType.issue,
            linked_id=external_issue.id,
            relationship=GroupLink.Relationship.references,
        )

        path = '/api/0/issues/{}/integrations/'.format(group.id)

        response = self.client.get(path)

        assert response.data[0] == {
            'id': six.text_type(integration.id),
            'name': integration.name,
            'icon': integration.metadata.get('icon'),
            'domainName': integration.metadata.get('domain_name'),
            'provider': {
                'key': integration.get_provider().key,
                'name': integration.get_provider().name,
            },
            'externalIssues': [{
                'description': 'this is an example description',
                'id': six.text_type(external_issue.id),
                'key': 'APP-123',
                'title': 'this is an example title'
            }],
        }
