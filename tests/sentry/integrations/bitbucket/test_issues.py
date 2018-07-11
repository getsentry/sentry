from __future__ import absolute_import

from sentry.models import ExternalIssue, Integration
from sentry.testutils import APITestCase

import json
import responses


class BitbucketIssueTest(APITestCase):
    def setUp(self):
        self.base_url = 'https://api.bitbucket.org'
        self.shared_secret = '234567890'
        self.subject = 'connect:1234567'
        self.integration = Integration.objects.create(
            provider='bitbucket',
            external_id=self.subject,
            name='MyBitBucket',
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
            'https://api.bitbucket.org/2.0/repositories/MyBitBucket/{repo}/issues/{issue_id}'.format(
                repo=repo, issue_id=issue_id),
            json={'id': issue_id, 'title': 'hello', 'content': {'html': 'This is the description'}}
        )

        data = {
            'repo': repo,
            'externalIssue': issue_id,
            'comment': 'hello',
        }

        assert self.integration.get_installation().get_issue(issue_id, data=data) == {
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
            'https://api.bitbucket.org/2.0/repositories/MyBitBucket/{repo}/issues/{issue_id}/comments'.format(
                repo=repo, issue_id=issue_id),
            status=201,
            json={'content': {'raw': comment}},
        )

        external_issue = ExternalIssue.objects.create(
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            key='%s#%d' % (repo, issue_id),
        )

        self.integration.get_installation().after_link_issue(external_issue, data=comment)

        request = responses.calls[0].request
        assert responses.calls[0].response.status_code == 201
        payload = json.loads(request.body)
        assert payload == {'content': {'raw': comment['comment']}}
