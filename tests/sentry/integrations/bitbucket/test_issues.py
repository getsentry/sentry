from __future__ import absolute_import

from sentry.models import ExternalIssue, Integration
from sentry.testutils import APITestCase

import json
import responses
import six


class BitbucketIssueTest(APITestCase):
    def setUp(self):
        self.base_url = 'https://api.bitbucket.org'
        self.shared_secret = '234567890'
        self.subject = 'connect:1234567'
        self.integration = Integration.objects.create(
            provider='bitbucket',
            external_id=self.subject,
            name='myaccount',
            metadata={
                'base_url': self.base_url,
                'shared_secret': self.shared_secret,
                'subject': self.subject,
            }
        )

    @responses.activate
    def test_link_issue(self):
        issue_id = 3
        repo = 'myaccount/myrepo'
        responses.add(
            responses.GET,
            u'https://api.bitbucket.org/2.0/repositories/{repo}/issues/{issue_id}'.format(
                repo=repo, issue_id=issue_id),
            json={'id': issue_id, 'title': 'hello', 'content': {'html': 'This is the description'}}
        )

        data = {
            'repo': repo,
            'externalIssue': issue_id,
            'comment': 'hello',
        }

        assert self.integration.get_installation(None).get_issue(issue_id, data=data) == {
            'key': issue_id,
            'description': 'This is the description',
            'title': 'hello',
            'repo': repo,
        }

    @responses.activate
    def test_after_link_issue(self):
        issue_id = 3
        repo = 'myaccount/myrepo'
        comment = {'comment': 'hello I\'m a comment'}
        responses.add(
            responses.POST,
            u'https://api.bitbucket.org/2.0/repositories/{repo}/issues/{issue_id}/comments'.format(
                repo=repo, issue_id=issue_id),
            status=201,
            json={'content': {'raw': comment}},
        )

        external_issue = ExternalIssue.objects.create(
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            key='%s#%d' % (repo, issue_id),
        )

        self.integration.get_installation(
            external_issue.organization_id).after_link_issue(
            external_issue, data=comment)

        request = responses.calls[0].request
        assert responses.calls[0].response.status_code == 201
        payload = json.loads(request.body)
        assert payload == {'content': {'raw': comment['comment']}}

    @responses.activate
    def test_default_repo_link_fields(self):
        responses.add(
            responses.GET,
            'https://api.bitbucket.org/2.0/repositories/myaccount',
            body=b"""{
                "values": [
                    {"full_name": "myaccount/repo1"},
                    {"full_name": "myaccount/repo2"}
                ]
            }""",
            content_type='application/json',
        )
        group = self.create_group()
        self.create_event(group=group)
        org_integration = self.integration.add_organization(self.organization)
        org_integration.config = {
            'project_issue_defaults': {
                six.text_type(group.project_id): {'repo': 'myaccount/repo1'}
            }
        }
        org_integration.save()
        installation = self.integration.get_installation(self.organization.id)
        fields = installation.get_link_issue_config(group)
        for field in fields:
            if field['name'] == 'repo':
                repo_field = field
                break
        assert repo_field['default'] == 'myaccount/repo1'
        assert repo_field['defaultLabel'] == 'myaccount/repo1'

    @responses.activate
    def test_default_repo_create_fields(self):
        responses.add(
            responses.GET,
            'https://api.bitbucket.org/2.0/repositories/myaccount',
            body=b"""{
                "values": [
                    {"full_name": "myaccount/repo1"},
                    {"full_name": "myaccount/repo2"}
                ]
            }""",
            content_type='application/json',
        )
        group = self.create_group()
        self.create_event(group=group)
        org_integration = self.integration.add_organization(self.organization)
        org_integration.config = {
            'project_issue_defaults': {
                six.text_type(group.project_id): {'repo': 'myaccount/repo1'}
            }
        }
        org_integration.save()
        installation = self.integration.get_installation(self.organization.id)
        fields = installation.get_create_issue_config(group)
        for field in fields:
            if field['name'] == 'repo':
                repo_field = field
                break
        assert repo_field['default'] == 'myaccount/repo1'
        assert repo_field['defaultLabel'] == 'myaccount/repo1'
