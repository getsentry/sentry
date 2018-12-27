from __future__ import absolute_import

import responses

from exam import fixture
from django.test import RequestFactory
from time import time

from sentry.integrations.vsts.integration import VstsIntegration
from sentry.models import (
    ExternalIssue, Identity, IdentityProvider, Integration,
    IntegrationExternalProject
)
from sentry.testutils import TestCase
from sentry.utils import json

from .testutils import WORK_ITEM_RESPONSE, GET_PROJECTS_RESPONSE, GET_USERS_RESPONSE


class VstsIssueSycnTest(TestCase):
    @fixture
    def request(self):
        return RequestFactory()

    def setUp(self):
        model = Integration.objects.create(
            provider='vsts',
            external_id='vsts_external_id',
            name='fabrikam-fiber-inc',
            metadata={
                'domain_name': 'fabrikam-fiber-inc.visualstudio.com',
                'default_project': '0987654321',
            }
        )
        identity = Identity.objects.create(
            idp=IdentityProvider.objects.create(
                type='vsts',
                config={},
            ),
            user=self.user,
            external_id='vsts',
            data={
                'access_token': '123456789',
                'expires': time() + 1234567,
            }
        )
        model.add_organization(self.organization.id, identity.id)
        self.config = {
            'resolve_status': 'Resolved',
            'resolve_when': 'Resolved',
            'regression_status': 'Active',
            'sync_comments': True,
            'sync_forward_assignment': True,
            'sync_reverse_assignment': True,
        }
        model.add_project(self.project.id, self.config)
        self.integration = VstsIntegration(model, self.organization.id)
        self.issue_id = 309

    @responses.activate
    def test_create_issue(self):
        responses.add(
            responses.PATCH,
            'https://fabrikam-fiber-inc.visualstudio.com/0987654321/_apis/wit/workitems/$Bug?api-version=3.0',
            body=WORK_ITEM_RESPONSE,
            content_type='application/json',
        )

        # group = self.create_group(message='Hello world', culprit='foo.bar')

        form_data = {
            'title': 'Hello',
            'description': 'Fix this.',
        }
        assert self.integration.create_issue(form_data) == {
            'key': self.issue_id,
            'description': 'Fix this.',
            'title': 'Hello',
        }
        request = responses.calls[-1].request
        assert request.headers['Content-Type'] == 'application/json-patch+json'
        payload = json.loads(request.body)
        assert payload == [
            {
                'op': 'add',
                'path': '/fields/System.Title',
                'value': 'Hello',
            },
            # Adds both a comment and a description.
            # See method for details.
            {
                'op': 'add',
                'path': '/fields/System.Description',
                'value': '<p>Fix this.</p>\n',
            },
            {
                'op': 'add',
                'path': '/fields/System.History',
                'value': '<p>Fix this.</p>\n',
            },
            # {
            #     "op": "add",
            #     "path": "/relations/-",
            #     "value": {
            #         "rel": "Hyperlink",
            #         "url": 'http://testserver/baz/bar/issues/1/',
            #     }
            # }
        ]

    @responses.activate
    def test_get_issue(self):
        responses.add(
            responses.GET,
            'https://fabrikam-fiber-inc.visualstudio.com/DefaultCollection/_apis/wit/workitems/%d' % self.issue_id,
            body=WORK_ITEM_RESPONSE,
            content_type='application/json',
        )
        assert self.integration.get_issue(self.issue_id) == {
            'key': self.issue_id,
            'description': 'Fix this.',
            'title': 'Hello',
        }
        request = responses.calls[-1].request
        assert request.headers['Content-Type'] == 'application/json'

    @responses.activate
    def test_sync_assignee_outbound(self):
        vsts_work_item_id = 5
        responses.add(
            responses.PATCH,
            'https://fabrikam-fiber-inc.visualstudio.com/DefaultCollection/_apis/wit/workitems/%d' % vsts_work_item_id,
            body=WORK_ITEM_RESPONSE,
            content_type='application/json',
        )
        responses.add(
            responses.GET,
            'https://fabrikam-fiber-inc.vssps.visualstudio.com/_apis/graph/users',
            body=GET_USERS_RESPONSE,
            content_type='application/json',
        )

        user = self.create_user('ftotten@vscsi.us')
        external_issue = ExternalIssue.objects.create(
            organization_id=self.organization.id,
            integration_id=self.integration.model.id,
            key=vsts_work_item_id,
            title='I\'m a title!',
            description='I\'m a description.'
        )
        self.integration.sync_assignee_outbound(external_issue, user, assign=True)
        assert len(responses.calls) == 2
        assert responses.calls[0].request.url == 'https://fabrikam-fiber-inc.vssps.visualstudio.com/_apis/graph/users'
        assert responses.calls[0].response.status_code == 200
        assert responses.calls[1].request.url == 'https://fabrikam-fiber-inc.visualstudio.com/DefaultCollection/_apis/wit/workitems/%d' % vsts_work_item_id
        assert responses.calls[1].response.status_code == 200

    @responses.activate
    def test_sync_status_outbound(self):
        vsts_work_item_id = 5
        responses.add(
            responses.PATCH,
            'https://fabrikam-fiber-inc.visualstudio.com/DefaultCollection/_apis/wit/workitems/%d' % vsts_work_item_id,
            body=WORK_ITEM_RESPONSE,
            content_type='application/json',
        )
        responses.add(
            responses.GET,
            'https://fabrikam-fiber-inc.vssps.visualstudio.com/_apis/graph/users',
            body=GET_USERS_RESPONSE,
            content_type='application/json',
        )
        responses.add(
            responses.GET,
            'https://fabrikam-fiber-inc.visualstudio.com/DefaultCollection/_apis/wit/workitems/%d' % vsts_work_item_id,
            body=WORK_ITEM_RESPONSE,
            content_type='application/json',
        )
        responses.add(
            responses.GET,
            'https://fabrikam-fiber-inc.visualstudio.com/DefaultCollection/_apis/projects',
            body=GET_PROJECTS_RESPONSE,
            content_type='application/json',
        )

        external_issue = ExternalIssue.objects.create(
            organization_id=self.organization.id,
            integration_id=self.integration.model.id,
            key=vsts_work_item_id,
            title='I\'m a title!',
            description='I\'m a description.'
        )

        IntegrationExternalProject.objects.create(
            external_id='ac7c05bb-7f8e-4880-85a6-e08f37fd4a10',
            organization_integration_id=self.integration.org_integration.id,
            resolved_status='Resolved',
            unresolved_status='New',
        )
        self.integration.sync_status_outbound(external_issue, True, self.project.id)
        assert len(responses.calls) == 3
        req = responses.calls[2].request
        assert req.url == 'https://fabrikam-fiber-inc.visualstudio.com/DefaultCollection/_apis/wit/workitems/%d' % vsts_work_item_id
        assert req.body == '[{"path": "/fields/System.State", "value": "Resolved", "op": "replace"}]'
        assert responses.calls[2].response.status_code == 200

    def test_get_issue_url(self):
        work_id = 345
        url = self.integration.get_issue_url(work_id)
        assert url == 'https://fabrikam-fiber-inc.visualstudio.com/_workitems/edit/345'
