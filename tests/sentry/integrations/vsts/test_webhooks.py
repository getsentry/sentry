from __future__ import absolute_import
from django.core.urlresolvers import reverse

import responses
from mock import patch
from time import time

from sentry.testutils import APITestCase
from sentry.models import Activity, CommitAuthor, ExternalIssue, Group, GroupLink, GroupStatus, Identity, IdentityProvider, Integration, PullRequest, Repository
from sentry.integrations.vsts.integration import VstsIntegration
from sentry.utils.http import absolute_uri
from .testutils import (
    WORK_ITEM_UPDATED,
    WORK_ITEM_UNASSIGNED,
    WORK_ITEM_UPDATED_STATUS,
    WORK_ITEM_STATES,
    PR_WEBHOOK,
)


class VstsWebhookWorkItemTest(APITestCase):
    def setUp(self):
        self.organization = self.create_organization()
        self.project = self.create_project(organization=self.organization)
        self.access_token = '1234567890'
        self.account_id = u'90e9a854-eb98-4c56-ae1a-035a0f331dd6'
        self.instance = 'instance.visualstudio.com'
        self.shared_secret = '1234567890'
        self.model = Integration.objects.create(
            provider='vsts',
            external_id=self.account_id,
            name='vsts_name',
            metadata={
                 'domain_name': 'instance.visualstudio.com',
                 'subscription': {
                     'id': 1234,
                     'secret': self.shared_secret,
                 }
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
                'expires': int(time()) + int(1234567890),
            }
        )
        self.org_integration = self.model.add_organization(self.organization.id, self.identity.id)
        self.org_integration.config = {
            'sync_status_reverse': True,
            'sync_status_forward': True,
            'sync_comments': True,
            'sync_forward_assignment': True,
            'sync_reverse_assignment': True,
        }
        self.org_integration.save()
        self.integration = VstsIntegration(self.model, self.organization.id)

        self.user_to_assign = self.create_user('sentryuseremail@email.com')

    def create_linked_group(self, external_issue, project, status):
        group = self.create_group(project=project, status=status)
        GroupLink.objects.create(
            group_id=group.id,
            project_id=project.id,
            linked_type=GroupLink.LinkedType.issue,
            linked_id=external_issue.id,
            data={}
        )
        return group

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
                absolute_uri('/extensions/vsts/issue-updated/'),
                data=WORK_ITEM_UPDATED,
                HTTP_SHARED_SECRET=self.shared_secret,
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
                absolute_uri('/extensions/vsts/issue-updated/'),
                data=WORK_ITEM_UNASSIGNED,
                HTTP_SHARED_SECRET=self.shared_secret,
            )

            assert resp.status_code == 200
            external_issue = ExternalIssue.objects.get(id=external_issue.id)
            assert mock.call_count == 1
            args = mock.call_args[1]

            assert args['integration'].__class__ == Integration
            assert args['email'] is None
            assert args['external_issue_key'] == work_item_id
            assert args['assign'] is False

    @responses.activate
    def test_inbound_status_sync_resolve(self):
        responses.add(
            responses.GET,
            'https://instance.visualstudio.com/c0bf429a-c03c-4a99-9336-d45be74db5a6/_apis/wit/workitemtypes/Bug/states',
            json=WORK_ITEM_STATES,
        )
        work_item_id = 33
        num_groups = 5
        external_issue = ExternalIssue.objects.create(
            organization_id=self.organization.id,
            integration_id=self.model.id,
            key=work_item_id,
        )
        groups = [
            self.create_linked_group(
                external_issue,
                self.project,
                GroupStatus.UNRESOLVED) for _ in range(num_groups)]
        resp = self.client.post(
            absolute_uri('/extensions/vsts/issue-updated/'),
            data=WORK_ITEM_UPDATED_STATUS,
            HTTP_SHARED_SECRET=self.shared_secret,
        )
        assert resp.status_code == 200
        group_ids = [g.id for g in groups]
        assert len(
            Group.objects.filter(
                id__in=group_ids,
                status=GroupStatus.RESOLVED)) == num_groups
        assert len(Activity.objects.filter(group_id__in=group_ids)) == num_groups

    @responses.activate
    def test_inbound_status_sync_unresolve(self):
        responses.add(
            responses.GET,
            'https://instance.visualstudio.com/c0bf429a-c03c-4a99-9336-d45be74db5a6/_apis/wit/workitemtypes/Bug/states',
            json=WORK_ITEM_STATES,
        )
        work_item_id = 33
        num_groups = 5
        external_issue = ExternalIssue.objects.create(
            organization_id=self.organization.id,
            integration_id=self.model.id,
            key=work_item_id,
        )
        groups = [
            self.create_linked_group(
                external_issue,
                self.project,
                GroupStatus.RESOLVED) for _ in range(num_groups)]

        # Change so that state is changing from resolved to unresolved
        state = WORK_ITEM_UPDATED_STATUS['resource']['fields']['System.State']
        state['oldValue'] = 'Resolved'
        state['newValue'] = 'Active'

        resp = self.client.post(
            absolute_uri('/extensions/vsts/issue-updated/'),
            data=WORK_ITEM_UPDATED_STATUS,
            HTTP_SHARED_SECRET=self.shared_secret,
        )
        assert resp.status_code == 200
        group_ids = [g.id for g in groups]
        assert len(
            Group.objects.filter(
                id__in=group_ids,
                status=GroupStatus.UNRESOLVED)) == num_groups
        assert len(Activity.objects.filter(group_id__in=group_ids)) == num_groups


class VstsWebhookPullRequestTest(APITestCase):
    def setUp(self):
        self.organization = self.create_organization()
        self.project = self.create_project(organization=self.organization)
        self.access_token = '1234567890'
        self.account_id = 'f844ec47-a9db-4511-8281-8b63f4eaf94e'
        self.instance = 'instance.visualstudio.com'
        self.shared_secret = '1234567890'
        self.model = Integration.objects.create(
            provider='vsts',
            external_id=self.account_id,
            name='vsts_name',
            metadata={
                 'domain_name': 'instance.visualstudio.com',
                 'subscription': {
                     'id': 1234,
                     'secret': self.shared_secret,
                 }
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
                'expires': int(time()) + int(1234567890),
            }
        )
        self.org_integration = self.model.add_organization(self.organization.id, self.identity.id)
        self.org_integration.config = {
            'sync_status_reverse': True,
            'sync_status_forward': True,
            'sync_comments': True,
            'sync_forward_assignment': True,
            'sync_reverse_assignment': True,
        }
        self.org_integration.save()
        self.integration = VstsIntegration(self.model, self.organization.id)

    def test_simple(self):
        repo = Repository.objects.create(
            organization_id=self.organization.id,
            name='Repo',
            provider='integrations:vsts',
            external_id='4bc14d40-c903-45e2-872e-0462c7748079',
            integration_id=self.integration.model.id,
        )

        resp = self.client.post(
            reverse('sentry-extensions-vsts-issue-updated'),
            data=PR_WEBHOOK,
            HTTP_SHARED_SECRET=self.shared_secret,
        )

        assert resp.status_code == 200

        commit_author = CommitAuthor.objects.get(
            external_id='54d125f7-69f7-4191-904f-c5b96b6261c8',
            organization_id=self.organization.id,
        )
        assert commit_author.name == 'Jamal Hartnett'
        assert commit_author.email == 'fabrikamfiber4@hotmail.com'

        pull_request = PullRequest.objects.get(
            repository_id=repo.id,
            key='6872ee8c-b333-4eff-bfb9-0d5274943566'
        )
        assert pull_request.organization_id == self.organization.id
        assert pull_request.title == 'my first pull request'
        assert pull_request.message == ' - test2\r\n'
        assert pull_request.author == commit_author
        assert pull_request.merge_commit_sha == 'eef717f69257a6333f221566c1c987dc94cc0d72'
