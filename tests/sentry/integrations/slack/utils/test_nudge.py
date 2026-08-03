from unittest.mock import patch

from sentry.integrations.slack.utils.nudge import should_send_nudge_block
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature

FEATURE_FLAG = "organizations:slack-reinstall-nudge-on-issue-alert"


class ShouldSendNudgeBlockTest(TestCase):
    channel_id = "C1234567890"

    def setUp(self) -> None:
        super().setUp()
        # By default make the random gate pass; individual tests override this.
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
        # Default nudge frequency is 0.3 (30%), so 0.5 should fail the check
        with patch("sentry.integrations.slack.utils.nudge.random.random", return_value=0.5):
            assert (
                should_send_nudge_block(channel_id=self.channel_id, organization=self.organization)
                is False
            )

    @with_feature(FEATURE_FLAG)
    def test_custom_nudge_frequency(self) -> None:
        # Set a custom nudge frequency to 50%
        with self.options({"slack.nudge-frequency": 0.5}):
            # Random value 0.4 should pass with 50% threshold
            with patch("sentry.integrations.slack.utils.nudge.random.random", return_value=0.4):
                assert (
                    should_send_nudge_block(
                        channel_id=self.channel_id, organization=self.organization
                    )
                    is True
                )

            # Random value 0.6 should fail with 50% threshold
            with patch("sentry.integrations.slack.utils.nudge.random.random", return_value=0.6):
                assert (
                    should_send_nudge_block(
                        channel_id=self.channel_id, organization=self.organization
                    )
                    is False
                )

    @with_feature(FEATURE_FLAG)
    def test_posts_block(self) -> None:
        assert (
            should_send_nudge_block(channel_id=self.channel_id, organization=self.organization)
            is True
        )
