from __future__ import absolute_import

import json
import responses

from sentry import options
from sentry.models import Integration, OrganizationIntegration
from sentry.testutils import APITestCase

UNSET = object()

LINK_SHARED_EVENT = """{
    "type": "link_shared",
    "channel": "Cxxxxxx",
    "user": "Uxxxxxxx",
    "message_ts": "123456789.9875",
    "links": [
        {
            "domain": "example.com",
            "url": "http://testserver/fizz/buzz"
        },
        {
            "domain": "example.com",
            "url": "http://testserver/sentry/sentry/issues/%(group1)s/"
        },
        {
            "domain": "example.com",
            "url": "http://testserver/sentry/sentry/issues/%(group2)s/bar/"
        },
        {
            "domain": "example.com",
            "url": "http://testserver/sentry/sentry/issues/%(group1)s/bar/"
        },
        {
            "domain": "another-example.com",
            "url": "https://yet.another-example.com/v/abcde"
        }
    ]
}"""


class BaseEventTest(APITestCase):
    def setUp(self):
        super(BaseEventTest, self).setUp()
        self.user = self.create_user(is_superuser=False)
        self.org = self.create_organization(owner=None)
        self.integration = Integration.objects.create(
            provider='slack',
            external_id='TXXXXXXX1',
            metadata={
                'access_token': 'xoxp-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx',
                'bot_access_token': 'xoxb-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx',
            }
        )
        OrganizationIntegration.objects.create(
            organization=self.org,
            integration=self.integration,
        )

    def post_webhook(self, event_data=None, type='event_callback', data=None,
                     token=UNSET, team_id='TXXXXXXX1'):
        if token is UNSET:
            token = options.get('slack.verification-token')
        payload = {
            'token': token,
            'team_id': team_id,
            'api_app_id': 'AXXXXXXXX1',
            'type': type,
            'authed_users': [],
            'event_id': 'Ev08MFMKH6',
            'event_time': 123456789,
        }
        if data:
            payload.update(data)
        if event_data:
            payload.setdefault('event', {}).update(event_data)
        return self.client.post(
            '/extensions/slack/event/',
            payload,
        )


class UrlVerificationEventTest(BaseEventTest):
    challenge = '3eZbrw1aBm2rZgRNFdxV2595E9CY3gmdALWMmHkvFXO7tYXAYM8P'

    def test_valid_token(self):
        resp = self.client.post(
            '/extensions/slack/event/',
            {
                'type': 'url_verification',
                'challenge': self.challenge,
                'token': options.get('slack.verification-token'),
            }
        )
        assert resp.status_code == 200, resp.content
        assert resp.data['challenge'] == self.challenge

    def test_invalid_token(self):
        resp = self.client.post(
            '/extensions/slack/event/',
            {
                'type': 'url_verification',
                'challenge': self.challenge,
                'token': 'fizzbuzz',
            }
        )
        assert resp.status_code == 400, resp.content


class LinkSharedEventTest(BaseEventTest):
    @responses.activate
    def test_valid_token(self):
        responses.add(responses.POST, 'https://slack.com/api/chat.unfurl',
                      json={'ok': True})
        org2 = self.create_organization(name='biz')
        project1 = self.create_project(organization=self.org)
        project2 = self.create_project(organization=org2)
        group1 = self.create_group(project=project1)
        group2 = self.create_group(project=project2)
        resp = self.post_webhook(event_data=json.loads(LINK_SHARED_EVENT % {
            'group1': group1.id,
            'group2': group2.id,
        }))
        assert resp.status_code == 200, resp.content
