from sentry.seer.entrypoints.cache import SeerOperatorPendingMentionCache
from sentry.seer.entrypoints.slack.entrypoint import SlackPendingMentionPayload
from sentry.seer.entrypoints.types import SeerEntrypointKey
from tests.sentry.integrations.slack.webhooks.actions import BaseEventTest

ENTRYPOINT_KEY = str(SeerEntrypointKey.SLACK)


class LinkIdentityActionTest(BaseEventTest):
    def _seed_cache(self, response_url: str | None) -> SlackPendingMentionPayload:
        payload = SlackPendingMentionPayload(
            payload={"method": "POST", "path": "/extensions/slack/event/"},
            integration_id=self.integration.id,
            slack_user_id=self.external_id,
            channel_id="C065W1189",
            thread_ts="100.000",
            message_ts="123.456",
            event_type="app_mention",
            message_text="hello",
            response_url=response_url,
        )
        SeerOperatorPendingMentionCache[SlackPendingMentionPayload].set(
            entrypoint_key=ENTRYPOINT_KEY,
            integration_id=self.integration.id,
            user_ext_id=self.external_id,
            cache_payload=payload,
        )
        return payload

    def test_stashes_response_url_on_pending_mention(self) -> None:
        original = self._seed_cache(response_url=None)

        resp = self.post_webhook(
            action_data=[{"action_id": "link_identity", "type": "button"}],
            type="block_actions",
        )

        assert resp.status_code == 200, resp.content
        cached = SeerOperatorPendingMentionCache[SlackPendingMentionPayload].pop(
            entrypoint_key=ENTRYPOINT_KEY,
            integration_id=self.integration.id,
            user_ext_id=self.external_id,
        )
        assert cached is not None
        # response_url is stashed; the rest of the payload is unchanged.
        assert dict(cached) == {**original, "response_url": self.response_url}

    def test_no_pending_cache_is_noop(self) -> None:
        resp = self.post_webhook(
            action_data=[{"action_id": "link_identity", "type": "button"}],
            type="block_actions",
        )

        assert resp.status_code == 200, resp.content
        # Nothing was created in the cache.
        cached = SeerOperatorPendingMentionCache[SlackPendingMentionPayload].pop(
            entrypoint_key=ENTRYPOINT_KEY,
            integration_id=self.integration.id,
            user_ext_id=self.external_id,
        )
        assert cached is None
