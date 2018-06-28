from __future__ import absolute_import

import responses

# from exam import fixture
from mock import patch

from time import time

from sentry.testutils import APITestCase
from sentry.models import ExternalIssue, Identity, IdentityProvider, Integration
from sentry.integrations.vsts.integration import VstsIntegration
# from sentry.integrations.vsts.webhooks import WorkItemWebhook
from sentry.utils.http import absolute_uri
# from .testutils import (
#    WORK_ITEM_UPDATED,
# )


class VstsWebhookWorkItemTest(APITestCase):
    def setUp(self):
        self.organization = self.create_organization()
        self.project = self.create_project(organization=self.organization)
        self.access_token = '1234567890'
        self.account_id = 'f844ec47-a9db-4511-8281-8b63f4eaf94e'
        self.instance = 'instance.visualstudio.com'
        self.model = Integration.objects.create(
            provider='vsts',
            external_id=self.account_id,
            name='vsts_name',
            metadata={
                 'domain_name': 'instance.visualstudio.com'
            }
        )
        self.identity_provider = IdentityProvider.objects.create(type='vsts')
        self.identity = Identity.objects.create(
            idp=self.identity_provider,
            user=self.user,
            external_id='vsts_id',
            data={
                'access_token': self.access_token,
                'refresh_token': 'qwertyuiop',
                'expires': int(time()) - int(1234567890),
            }
        )
        self.org_integration = self.model.add_organization(self.organization.id, self.identity.id)
        self.project_integration = self.model.add_project(self.project.id)
        self.integration = VstsIntegration(self.model, self.organization.id, self.project.id)

        self.user_to_assign = self.create_user('sentryuseremail@email.com')

    @responses.activate
    @patch('sentry.integrations.vsts.webhooks.sync_group_assignee_inbound')
    def test_workitem_change_assignee(self, mock_sync_group_assignee_inbound):
        work_item_id = '27646e0e-b520-4d2b-9411-bba7524947cd'
        external_issue = ExternalIssue.objects.create(
            organization_id=self.organization.id,
            integration_id=self.model.id,
            key=work_item_id,
        )

        work_item_updated = {
            'id': work_item_id,
            'eventType': 'workitem.updated',
            'resource': {
                'workItemId': 1,
                'fields': {
                    'System.State': {
                        'oldValue': 'New',
                        'newValue': 'Approved'
                    },
                    'System.Reason': {
                        'oldValue': 'New defect reported',
                        'newValue': 'Approved by the Product Owner'
                    },
                    'System.AssignedTo': {
                        'newValue': 'Jamal Hartnet'
                    },
                }
            },
            'resourceContainers': {
                'account': {
                    'id': self.account_id,
                },
            }
        }
        resp = self.client.post(
            absolute_uri('/extensions/vsts/webhooks/'),
            data=work_item_updated,
        )
        assert resp.status_code == 200
        external_issue = ExternalIssue.objects.get(id=external_issue.id)
        mock_sync_group_assignee_inbound.assert_called_with(
            self.integration, 'sentryuseremail@email.com', work_item_id, assign=True,
        )
