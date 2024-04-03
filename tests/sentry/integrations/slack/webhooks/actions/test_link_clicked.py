from sentry.testutils.helpers.features import with_feature
from tests.sentry.integrations.slack.webhooks.actions import BaseEventTest


class LinkClickedActionTest(BaseEventTest):
    def setUp(self):
        super().setUp()
        self.original_message = {
            "blocks": [
                {
                    "type": "section",
                    "block_id": "01NUP",
                    "text": {
                        "type": "mrkdwn",
                        "text": "Release meowmeowmeowmeowmeowmeowmeowmeowmeowmeow was deployed to development for these projects",
                        "verbatim": False,
                    },
                },
                {
                    "type": "context",
                    "block_id": "nyH6Z",
                    "elements": [
                        {
                            "type": "mrkdwn",
                            "text": "bar | <http://testserver/settings/account/notifications/deploy/?referrer=release_activity-slack-user&amp;notification_uuid=f3328419-9baf-4eb3-a596-11cf3d6dcae8|Notification Settings>",
                            "verbatim": False,
                        }
                    ],
                },
                {
                    "type": "actions",
                    "block_id": "TQK6Q",
                    "elements": [
                        {
                            "type": "button",
                            "action_id": "lnS2K",
                            "text": {"type": "plain_text", "text": "bar", "emoji": True},
                            "url": "http://testserver/organizations/baz/releases/meowmeowmeowmeowmeowmeowmeowmeowmeowmeow/?project=4553302353772544&unselectedSeries=Healthy&referrer=release_activity&notification_uuid=f3328419-9baf-4eb3-a596-11cf3d6dcae8",
                        },
                    ],
                },
            ]
        }

    @with_feature("organizations:slack-block-kit")
    def test_simple(self):
        resp = self.post_webhook(
            action_data=[{"name": "some_action", "value": "link_clicked"}],
            original_message=self.original_message,
            type="block_actions",
        )
        assert resp.status_code == 200, resp.content
