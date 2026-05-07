from tests.sentry.integrations.slack.webhooks.actions import BaseEventTest


class LinkIdentityActionTest(BaseEventTest):
    def test_deletes_original_ephemeral_via_response_url(self) -> None:
        resp = self.post_webhook(
            action_data=[{"action_id": "link_identity", "type": "button"}],
            type="block_actions",
        )

        assert resp.status_code == 200, resp.content
        self.mock_post.assert_called_once_with(delete_original=True)

    def test_no_response_url_is_noop(self) -> None:
        resp = self.post_webhook(
            action_data=[{"action_id": "link_identity", "type": "button"}],
            type="block_actions",
            data={"response_url": ""},
        )

        assert resp.status_code == 200, resp.content
        self.mock_post.assert_not_called()
