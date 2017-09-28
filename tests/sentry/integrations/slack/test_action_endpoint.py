from __future__ import absolute_import

import responses

from sentry import options
from sentry.models import Integration, OrganizationIntegration
from sentry.testutils import APITestCase

UNSET = object()


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

    def post_webhook(self, action_data=None, type='event_callback', data=None,
                     token=UNSET, team_id='TXXXXXXX1', callback_id='comic_1234_xyz'):
        if token is UNSET:
            token = options.get('slack.verification-token')
        payload = {
            'token': token,
            'team': {
                'id': team_id,
                'domain': 'example.com',
            },
            'channel': {
                'id': 'C065W1189',
                'domain': 'forgotten-works',
            },
            'user': {
                'id': 'U045VRZFT',
                'domain': 'example',
            },
            'callback_id': callback_id,
            'action_ts': '1458170917.164398',
            'message_ts': '1458170866.000004',
            'original_message': {},  # unused
            'trigger_id': '13345224609.738474920.8088930838d88f008e0',
            'response_url': 'https://hooks.slack.com/actions/T47563693/6204672533/x7ZLaiVMoECAW50Gw1ZYAXEM',
            'attachment_id': '1',
            'actions': action_data or [],
        }
        if data:
            payload.update(data)
        return self.client.post(
            '/extensions/slack/action/',
            payload,
        )


class StatusActionTest(BaseEventTest):
    @responses.activate
    def test_valid_token(self):
        responses.add(responses.POST, 'https://slack.com/api/chat.unfurl',
                      json={'ok': True})
        project1 = self.create_project(organization=self.org)
        group1 = self.create_group(project=project1)
        resp = self.post_webhook(action_data=[
            {
                'name': 'status',
                'value': 'ignore',
                'type': 'button'
            }
        ], callback_id='issue:{}'.format(group1.id))
        assert resp.status_code == 200, resp.content
