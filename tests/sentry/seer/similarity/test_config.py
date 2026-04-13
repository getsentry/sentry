from unittest.mock import patch

from sentry.seer.similarity.config import (
    SEER_GROUPING_NEW_MODEL_ROLLOUT_FEATURE,
    SEER_GROUPING_NEW_VERSION,
    SEER_GROUPING_NEXT_MODEL_ROLLOUT_FEATURE,
    SEER_GROUPING_NEXT_VERSION,
    SEER_GROUPING_STABLE_VERSION,
    get_grouping_model_version,
    get_new_model_version,
    is_new_model_rolled_out,
    should_send_to_seer_for_training,
)
from sentry.seer.similarity.types import GroupingVersion
from sentry.testutils.cases import TestCase


class GetGroupingModelVersionTest(TestCase):
    def test_returns_stable_when_no_flags(self) -> None:
        assert get_grouping_model_version(self.project) == SEER_GROUPING_STABLE_VERSION

    def test_returns_stable_when_rollout_disabled(self) -> None:
        with (
            patch("sentry.seer.similarity.config.SEER_GROUPING_NEW_VERSION", None),
            patch("sentry.seer.similarity.config.SEER_GROUPING_NEXT_VERSION", None),
        ):
            assert get_grouping_model_version(self.project) == SEER_GROUPING_STABLE_VERSION

    def test_returns_flagged_version(self) -> None:
        cases = [
            (SEER_GROUPING_NEW_MODEL_ROLLOUT_FEATURE, SEER_GROUPING_NEW_VERSION),
            (SEER_GROUPING_NEXT_MODEL_ROLLOUT_FEATURE, SEER_GROUPING_NEXT_VERSION),
        ]
        for feature_flag, expected_version in cases:
            with self.subTest(feature_flag=feature_flag), self.feature(feature_flag):
                assert get_grouping_model_version(self.project) == expected_version

    def test_next_flag_takes_priority_over_new_flag(self) -> None:
        with self.feature(
            [SEER_GROUPING_NEW_MODEL_ROLLOUT_FEATURE, SEER_GROUPING_NEXT_MODEL_ROLLOUT_FEATURE]
        ):
            assert get_grouping_model_version(self.project) == SEER_GROUPING_NEXT_VERSION

    def test_falls_back_to_new_when_next_version_is_none(self) -> None:
        with (
            patch("sentry.seer.similarity.config.SEER_GROUPING_NEXT_VERSION", None),
            self.feature(
                [SEER_GROUPING_NEW_MODEL_ROLLOUT_FEATURE, SEER_GROUPING_NEXT_MODEL_ROLLOUT_FEATURE]
            ),
        ):
            assert get_grouping_model_version(self.project) == SEER_GROUPING_NEW_VERSION


class IsNewModelRolledOutTest(TestCase):
    def test_returns_false_when_no_flags(self) -> None:
        assert is_new_model_rolled_out(self.project) is False

    def test_returns_false_when_all_versions_none(self) -> None:
        with (
            patch("sentry.seer.similarity.config.SEER_GROUPING_NEW_VERSION", None),
            patch("sentry.seer.similarity.config.SEER_GROUPING_NEXT_VERSION", None),
        ):
            assert is_new_model_rolled_out(self.project) is False

    def test_returns_true_when_flag_enabled(self) -> None:
        for feature_flag in [
            SEER_GROUPING_NEW_MODEL_ROLLOUT_FEATURE,
            SEER_GROUPING_NEXT_MODEL_ROLLOUT_FEATURE,
        ]:
            with self.subTest(feature_flag=feature_flag), self.feature(feature_flag):
                assert is_new_model_rolled_out(self.project) is True


class GetNewModelVersionTest(TestCase):
    def test_returns_configured_version(self) -> None:
        assert get_new_model_version() == GroupingVersion.V2

    def test_returns_none_when_disabled(self) -> None:
        with patch("sentry.seer.similarity.config.SEER_GROUPING_NEW_VERSION", None):
            assert get_new_model_version() is None


class ShouldSendToSeerForTrainingTest(TestCase):
    def test_returns_false_when_no_rollout(self) -> None:
        with (
            patch("sentry.seer.similarity.config.SEER_GROUPING_NEW_VERSION", None),
            patch("sentry.seer.similarity.config.SEER_GROUPING_NEXT_VERSION", None),
        ):
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
        cases = [
            # (feature_flag, seer_latest_training_model)
            (SEER_GROUPING_NEW_MODEL_ROLLOUT_FEATURE, None),
            (SEER_GROUPING_NEW_MODEL_ROLLOUT_FEATURE, "v1"),
            (SEER_GROUPING_NEXT_MODEL_ROLLOUT_FEATURE, None),
            (SEER_GROUPING_NEXT_MODEL_ROLLOUT_FEATURE, "v1"),
            (SEER_GROUPING_NEXT_MODEL_ROLLOUT_FEATURE, "v2"),  # v2 → v2.1 transition
        ]
        for feature_flag, training_model in cases:
            with self.subTest(feature_flag=feature_flag, training_model=training_model):
                with self.feature(feature_flag):
                    result = should_send_to_seer_for_training(
                        self.project, grouphash_seer_latest_training_model=training_model
                    )
                    assert result is True

    def test_returns_false_when_already_sent_to_current_version(self) -> None:
        cases = [
            # (feature_flag, seer_latest_training_model)
            (SEER_GROUPING_NEW_MODEL_ROLLOUT_FEATURE, "v2"),
            (SEER_GROUPING_NEXT_MODEL_ROLLOUT_FEATURE, "v2.1"),
        ]
        for feature_flag, training_model in cases:
            with self.subTest(feature_flag=feature_flag, training_model=training_model):
                with self.feature(feature_flag):
                    result = should_send_to_seer_for_training(
                        self.project, grouphash_seer_latest_training_model=training_model
                    )
                    assert result is False
