from __future__ import absolute_import

from sentry.models import ExternalIssue, GroupLink, Integration
from sentry.testutils import APITestCase


class GroupIntegrationDetailsTest(APITestCase):
    def test_simple(self):
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
