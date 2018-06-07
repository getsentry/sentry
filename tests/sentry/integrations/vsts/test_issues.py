from __future__ import absolute_import

import responses
import pytest

from exam import fixture
from django.test import RequestFactory


from sentry.integrations.vsts.integration import VstsIntegration
from sentry.models import GroupMeta, Identity, IdentityProvider, Integration
from sentry.testutils import TestCase
from sentry.utils import json

from .testutils import WORK_ITEM_RESPONSE


class VstsIssueSycnTest(TestCase):
    @fixture
    def request(self):
        return RequestFactory()

    def setUp(self):
        self.user = self.create_user()
        self.organization = self.create_organization(owner=self.user)

        model = Integration.objects.create(
            provider='vsts',
            external_id='vsts_external_id',
            name='fabrikam-fiber-inc.visualstudio.com',
            metadata={
                'domain_name': 'fabrikam-fiber-inc.visualstudio.com',
                'default_project': {
                    'name': 'DefaultProject',
                    'id': '0987654321',
                }
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
            }
        )
        model.add_organization(self.organization.id, identity.id)
        self.integration = VstsIntegration(model, self.organization.id)

    def test_get_issue_label(self):
        group = self.create_group(message='Hello world', culprit='foo.bar')
        assert self.integration.get_issue_label(group, {
            'id': 309,
        }) == 'Bug 309'

    def test_get_issue_url(self):
        group = self.create_group(message='Hello world', culprit='foo.bar')
        assert self.integration.get_issue_url(
            group,
            {
                'id': 309,
                'url': 'https://fabrikam-fiber-inc.visualstudio.com/DefaultProject/_workitems?id=309',
            },
        ) == 'https://fabrikam-fiber-inc.visualstudio.com/DefaultProject/_workitems?id=309'

    @responses.activate
    def test_create_issue(self):
        responses.add(
            responses.PATCH,
            'https://fabrikam-fiber-inc.visualstudio.com/DefaultProject/_apis/wit/workitems/$Bug?api-version=3.0',
            body=WORK_ITEM_RESPONSE,
            content_type='application/json',
        )

        group = self.create_group(message='Hello world', culprit='foo.bar')

        request = self.request.get('/')
        form_data = {
            'title': 'Hello',
            'description': 'Fix this.',
        }
        assert self.integration.create_issue(request, group, form_data) == {
            'id': 309,
            'url': 'https://fabrikam-fiber-inc.visualstudio.com/web/wi.aspx?pcguid=d81542e4-cdfa-4333-b082-1ae2d6c3ad16&id=309',
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
    def test_link_issue_without_comment(self):
        responses.add(
            responses.GET,
            'https://fabrikam-fiber-inc.visualstudio.com/DefaultCollection/_apis/wit/workitems/309?api-version=3.0',
            body=WORK_ITEM_RESPONSE,
            content_type='application/json',
        )

        group = self.create_group(message='Hello world', culprit='foo.bar')

        request = self.request.get('/')
        form_data = {
            'item_id': '309',
        }

        assert self.integration.link_issue(request, group, form_data) == {
            'id': 309,
            'title': 'Customer can sign in using their Microsoft Account',
            'url': 'https://fabrikam-fiber-inc.visualstudio.com/web/wi.aspx?pcguid=d81542e4-cdfa-4333-b082-1ae2d6c3ad16&id=309',
        }

    @responses.activate
    def test_link_issue_with_comment(self):
        responses.add(
            responses.PATCH,
            'https://fabrikam-fiber-inc.visualstudio.com/DefaultCollection/_apis/wit/workitems/309?api-version=3.0',
            body=WORK_ITEM_RESPONSE,
            content_type='application/json',
        )
        group = self.create_group(message='Hello world', culprit='foo.bar')

        request = self.request.get('/')
        form_data = {
            'item_id': '309',
            'comment': 'Fix this.',
        }

        assert self.integration.link_issue(request, group, form_data) == {
            'id': 309,
            'title': 'Customer can sign in using their Microsoft Account',
            'url': 'https://fabrikam-fiber-inc.visualstudio.com/web/wi.aspx?pcguid=d81542e4-cdfa-4333-b082-1ae2d6c3ad16&id=309',
        }
        request = responses.calls[-1].request
        assert request.headers['Content-Type'] == 'application/json-patch+json'
        payload = json.loads(request.body)
        assert payload == [
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

    @pytest.mark.skip(reason='Not Implemented Currently')
    @responses.activate
    def test_unlink_issue(self):
        group = self.create_group(message='Hello world', culprit='foo.bar')
        GroupMeta.objects.create(group=group, key='vsts:issue_id', value='309')

        request = self.request.get('/')
        assert self.integration.unlink_issue(request, group, {
            'id': 309,
            'title': 'Customer can sign in using their Microsoft Account',
            'url': 'https://fabrikam-fiber-inc.visualstudio.com/web/wi.aspx?pcguid=d81542e4-cdfa-4333-b082-1ae2d6c3ad16&id=309',
        })
