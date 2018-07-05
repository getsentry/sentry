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
from .testutils import (
    WORK_ITEM_UPDATED,
    WORK_ITEM_UNASSIGNED,
)


class VstsWebhookWorkItemTest(APITestCase):
    def setUp(self):
        self.organization = self.create_organization()
        self.project = self.create_project(organization=self.organization)
        self.access_token = '1234567890'
        self.account_id = u'80ded3e8-3cd3-43b1-9f96-52032624aa3a'
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
    def test_workitem_change_assignee(self):
        work_item_id = 31
        external_issue = ExternalIssue.objects.create(
            organization_id=self.organization.id,
            integration_id=self.model.id,
            key=work_item_id,
        )
        with patch('sentry.integrations.vsts.webhooks.sync_group_assignee_inbound') as mock:
            resp = self.client.post(
                absolute_uri('/extensions/vsts/webhook/'),
                data=WORK_ITEM_UPDATED,
            )

            assert resp.status_code == 200
            external_issue = ExternalIssue.objects.get(id=external_issue.id)
            assert mock.call_count == 1
            args = mock.call_args[1]

            assert args['integration'].__class__ == Integration
            assert args['email'] == 'lauryn@sentry.io'
            assert args['external_issue_key'] == work_item_id
            assert args['assign'] is True

    @responses.activate
    def test_workitem_unassign(self):
        work_item_id = 33
        external_issue = ExternalIssue.objects.create(
            organization_id=self.organization.id,
            integration_id=self.model.id,
            key=work_item_id,
        )
        with patch('sentry.integrations.vsts.webhooks.sync_group_assignee_inbound') as mock:
            resp = self.client.post(
                absolute_uri('/extensions/vsts/webhook/'),
                data=WORK_ITEM_UNASSIGNED,
            )

            assert resp.status_code == 200
            external_issue = ExternalIssue.objects.get(id=external_issue.id)
            assert mock.call_count == 1
            args = mock.call_args[1]

            assert args['integration'].__class__ == Integration
            assert args['email'] is None
            assert args['external_issue_key'] == work_item_id
            assert args['assign'] is False
