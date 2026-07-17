from unittest.mock import patch

from sentry.integrations.slack.utils.nudge import should_send_nudge_block
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature

FEATURE_FLAG = "organizations:slack-reinstall-nudge-on-issue-alert"


class ShouldSendNudgeBlockTest(TestCase):
    channel_id = "C1234567890"

    def setUp(self) -> None:
        super().setUp()
        # By default make the 30% random gate pass; individual tests override this.
        patcher = patch("sentry.integrations.slack.utils.nudge.random.random", return_value=0.0)
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_no_feature_flag(self) -> None:
        # Feature flag off: never post, even though the random gate passes.
        assert (
            should_send_nudge_block(channel_id=self.channel_id, organization=self.organization)
            is False
        )

    @with_feature(FEATURE_FLAG)
    def test_random_gate_fails(self) -> None:
        with patch("sentry.integrations.slack.utils.nudge.random.random", return_value=0.5):
            assert (
                should_send_nudge_block(channel_id=self.channel_id, organization=self.organization)
                is False
            )

    @with_feature(FEATURE_FLAG)
    def test_posts_block(self) -> None:
        assert (
            should_send_nudge_block(channel_id=self.channel_id, organization=self.organization)
            is True
        )
