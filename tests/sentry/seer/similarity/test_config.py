from unittest.mock import patch

from sentry.seer.similarity.config import (
    SEER_GROUPING_NEXT_MODEL_ROLLOUT_FEATURE,
    SEER_GROUPING_NEXT_VERSION,
    SEER_GROUPING_STABLE_VERSION,
    get_grouping_model_version,
    should_send_to_seer_for_training,
)
from sentry.testutils.cases import TestCase


class GetGroupingModelVersionTest(TestCase):
    def test_returns_stable_when_no_flags(self) -> None:
        assert get_grouping_model_version(self.project) == SEER_GROUPING_STABLE_VERSION

    def test_returns_stable_when_rollout_disabled(self) -> None:
        with patch("sentry.seer.similarity.config.SEER_GROUPING_NEXT_VERSION", None):
            assert get_grouping_model_version(self.project) == SEER_GROUPING_STABLE_VERSION

    def test_returns_next_version_when_flag_enabled(self) -> None:
        with self.feature(SEER_GROUPING_NEXT_MODEL_ROLLOUT_FEATURE):
            assert get_grouping_model_version(self.project) == SEER_GROUPING_NEXT_VERSION

    def test_flag_is_noop_when_version_is_none(self) -> None:
        with (
            patch("sentry.seer.similarity.config.SEER_GROUPING_NEXT_VERSION", None),
            self.feature(SEER_GROUPING_NEXT_MODEL_ROLLOUT_FEATURE),
        ):
            assert get_grouping_model_version(self.project) == SEER_GROUPING_STABLE_VERSION


class ShouldSendToSeerForTrainingTest(TestCase):
    def test_returns_false_when_no_rollout(self) -> None:
        with patch("sentry.seer.similarity.config.SEER_GROUPING_NEXT_VERSION", None):
            result = should_send_to_seer_for_training(
                self.project, grouphash_seer_latest_training_model=None
            )
            assert result is False

    def test_returns_false_when_no_flags(self) -> None:
        result = should_send_to_seer_for_training(
            self.project, grouphash_seer_latest_training_model=None
        )
        assert result is False

    def test_returns_true_when_training_needed(self) -> None:
        # Old training models that should trigger retraining for the current rollout version
        for training_model in [None, "v1", "v2"]:
            with self.subTest(training_model=training_model):
                with self.feature(SEER_GROUPING_NEXT_MODEL_ROLLOUT_FEATURE):
                    result = should_send_to_seer_for_training(
                        self.project, grouphash_seer_latest_training_model=training_model
                    )
                    assert result is True

    def test_returns_false_when_already_sent_to_current_version(self) -> None:
        with self.feature(SEER_GROUPING_NEXT_MODEL_ROLLOUT_FEATURE):
            result = should_send_to_seer_for_training(
                self.project, grouphash_seer_latest_training_model="v2.1"
            )
            assert result is False
