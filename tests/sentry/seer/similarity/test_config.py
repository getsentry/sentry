from unittest.mock import Mock, patch

import pytest

from sentry.models.project import Project
from sentry.seer.similarity.config import (
    SEER_GROUPING_NEXT_MODEL_ROLLOUT_FEATURE,
    SEER_GROUPING_SKIP_FALLBACK_FEATURE,
    get_grouping_model_version,
    should_send_to_seer_for_training,
    should_skip_seer_fallback,
)
from sentry.seer.similarity.types import GroupingVersion


@pytest.fixture
def project() -> Project:
    return Mock(spec=Project)


def test_stable_model_needs_no_training(project: Project) -> None:
    assert get_grouping_model_version(project) == GroupingVersion.V2_1
    assert not should_send_to_seer_for_training(project, None)


@pytest.mark.parametrize("training_model", [None, "v1", "v2", "v2.1"])
def test_no_training_after_promotion(project: Project, training_model: str | None) -> None:
    assert not should_send_to_seer_for_training(project, training_model)


@pytest.mark.parametrize("training_model", [None, "v1", "v2"])
def test_next_model_needs_training(project: Project, training_model: str | None) -> None:
    with (
        patch("sentry.seer.similarity.config.SEER_GROUPING_STABLE_VERSION", GroupingVersion.V1),
        patch("sentry.seer.similarity.config.SEER_GROUPING_NEXT_VERSION", GroupingVersion.V2_1),
        patch("sentry.seer.similarity.config.features.has", return_value=True),
    ):
        assert get_grouping_model_version(project) == GroupingVersion.V2_1
        assert should_send_to_seer_for_training(project, training_model)


def test_no_duplicate_training(project: Project) -> None:
    with (
        patch("sentry.seer.similarity.config.SEER_GROUPING_STABLE_VERSION", GroupingVersion.V1),
        patch("sentry.seer.similarity.config.SEER_GROUPING_NEXT_VERSION", GroupingVersion.V2_1),
        patch("sentry.seer.similarity.config.features.has", return_value=True),
    ):
        assert not should_send_to_seer_for_training(project, "v2.1")


def test_no_training_when_next_model_is_stable(project: Project) -> None:
    with (
        patch("sentry.seer.similarity.config.SEER_GROUPING_NEXT_VERSION", GroupingVersion.V2_1),
        patch("sentry.seer.similarity.config.features.has", return_value=True),
    ):
        assert not should_send_to_seer_for_training(project, None)


@pytest.mark.parametrize("flag_enabled", [False, True])
def test_flags_are_dormant_without_next_model(project: Project, flag_enabled: bool) -> None:
    with patch("sentry.seer.similarity.config.features.has", return_value=flag_enabled) as has:
        assert get_grouping_model_version(project) == GroupingVersion.V2_1
        assert should_skip_seer_fallback(project)
        assert not should_send_to_seer_for_training(project, None)
        has.assert_not_called()


@pytest.mark.parametrize("rollout_enabled", [False, True])
@pytest.mark.parametrize("skip_fallback", [False, True])
def test_candidate_controls_are_independent(
    project: Project, rollout_enabled: bool, skip_fallback: bool
) -> None:
    flag_values = {
        SEER_GROUPING_NEXT_MODEL_ROLLOUT_FEATURE: rollout_enabled,
        SEER_GROUPING_SKIP_FALLBACK_FEATURE: skip_fallback,
    }
    with (
        patch("sentry.seer.similarity.config.SEER_GROUPING_STABLE_VERSION", GroupingVersion.V1),
        patch("sentry.seer.similarity.config.SEER_GROUPING_NEXT_VERSION", GroupingVersion.V2_1),
        patch(
            "sentry.seer.similarity.config.features.has",
            side_effect=lambda flag, project: flag_values[flag],
        ) as has,
    ):
        assert get_grouping_model_version(project) == (
            GroupingVersion.V2_1 if rollout_enabled else GroupingVersion.V1
        )
        assert should_send_to_seer_for_training(project, None) is rollout_enabled
        assert should_skip_seer_fallback(project) is skip_fallback
        has.assert_any_call(SEER_GROUPING_NEXT_MODEL_ROLLOUT_FEATURE, project)
        has.assert_any_call(SEER_GROUPING_SKIP_FALLBACK_FEATURE, project)
