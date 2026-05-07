from sentry.integrations.slack.views.link_identity import pop_link_identity_response_url
from sentry.silo.base import SiloMode
from sentry.testutils.silo import assume_test_silo_mode
from tests.sentry.integrations.slack.webhooks.actions import BaseEventTest


class LinkIdentityActionTest(BaseEventTest):
    def test_returns_200(self) -> None:
        resp = self.post_webhook(
            action_data=[{"action_id": "link_identity", "type": "button"}],
            type="block_actions",
        )

        assert resp.status_code == 200, resp.content

    def test_stashes_response_url_in_monolith(self) -> None:
        with assume_test_silo_mode(SiloMode.MONOLITH):
            resp = self.post_webhook(
                action_data=[{"action_id": "link_identity", "type": "button"}],
                type="block_actions",
            )

        assert resp.status_code == 200, resp.content
        stashed = pop_link_identity_response_url(
            integration_id=self.integration.id,
            slack_user_id=self.external_id,
        )
        assert stashed == self.response_url

    def test_skips_stash_in_monolith_without_response_url(self) -> None:
        with assume_test_silo_mode(SiloMode.MONOLITH):
            resp = self.post_webhook(
                action_data=[{"action_id": "link_identity", "type": "button"}],
                type="block_actions",
                data={"response_url": ""},
            )

        assert resp.status_code == 200, resp.content
        stashed = pop_link_identity_response_url(
            integration_id=self.integration.id,
            slack_user_id=self.external_id,
        )
        assert stashed is None
