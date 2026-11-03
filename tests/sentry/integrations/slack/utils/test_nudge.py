from unittest.mock import patch

from sentry.integrations.slack.utils.nudge import should_send_nudge_block
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature

FEATURE_FLAG = "organizations:slack-reinstall-nudge-on-issue-alert"
NOTIFICATION_UUID = "7f4b5c2e-2d0c-4d55-9a6f-1d3c0a7e9b21"


class ShouldSendNudgeBlockTest(TestCase):
    def test_no_feature_flag(self) -> None:
        with self.options({"slack.nudge-frequency": 1.0}):
            assert (
                should_send_nudge_block(
                    organization=self.organization, notification_uuid=NOTIFICATION_UUID
                )
                is False
            )

    @with_feature(FEATURE_FLAG)
    def test_posts_block(self) -> None:
        with self.options({"slack.nudge-frequency": 1.0}):
            assert (
                should_send_nudge_block(
                    organization=self.organization, notification_uuid=NOTIFICATION_UUID
                )
                is True
            )

    @with_feature(FEATURE_FLAG)
    def test_zero_frequency(self) -> None:
        with self.options({"slack.nudge-frequency": 0.0}):
            assert (
                should_send_nudge_block(
                    organization=self.organization, notification_uuid=NOTIFICATION_UUID
                )
                is False
            )

    @with_feature(FEATURE_FLAG)
    def test_keyed_on_notification_uuid(self) -> None:
        with self.options({"slack.nudge-frequency": 0.5}):
            decisions = {
                uuid: should_send_nudge_block(
                    organization=self.organization, notification_uuid=uuid
                )
                for uuid in (f"{i:032x}" for i in range(20))
            }
            assert set(decisions.values()) == {True, False}
            for uuid, decision in decisions.items():
                assert (
                    should_send_nudge_block(organization=self.organization, notification_uuid=uuid)
                    is decision
                )

    @with_feature(FEATURE_FLAG)
    def test_random_without_notification_uuid(self) -> None:
        with self.options({"slack.nudge-frequency": 0.5}):
            with patch("sentry.options.rollout.random.random", return_value=0.4):
                assert (
                    should_send_nudge_block(organization=self.organization, notification_uuid=None)
                    is True
                )
            with patch("sentry.options.rollout.random.random", return_value=0.6):
                assert (
                    should_send_nudge_block(organization=self.organization, notification_uuid=None)
                    is False
                )
