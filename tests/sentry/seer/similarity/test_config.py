from unittest.mock import patch

import pytest

from sentry.seer.similarity.config import (
    get_grouping_model_version,
    should_send_to_seer_for_training,
)
from sentry.seer.similarity.types import GroupingVersion


def test_stable_model_needs_no_training() -> None:
    assert get_grouping_model_version() == GroupingVersion.V2_1
    assert not should_send_to_seer_for_training(None)


@pytest.mark.parametrize("training_model", [None, "v1", "v2", "v2.1"])
def test_no_training_after_promotion(training_model: str | None) -> None:
    assert not should_send_to_seer_for_training(training_model)


@pytest.mark.parametrize("training_model", [None, "v1", "v2"])
def test_next_model_needs_training(training_model: str | None) -> None:
    with (
        patch("sentry.seer.similarity.config.SEER_GROUPING_STABLE_VERSION", GroupingVersion.V1),
        patch("sentry.seer.similarity.config.SEER_GROUPING_NEXT_VERSION", GroupingVersion.V2_1),
    ):
        assert get_grouping_model_version() == GroupingVersion.V2_1
        assert should_send_to_seer_for_training(training_model)


def test_no_duplicate_training() -> None:
    with (
        patch("sentry.seer.similarity.config.SEER_GROUPING_STABLE_VERSION", GroupingVersion.V1),
        patch("sentry.seer.similarity.config.SEER_GROUPING_NEXT_VERSION", GroupingVersion.V2_1),
    ):
        assert not should_send_to_seer_for_training("v2.1")


def test_no_training_when_next_model_is_stable() -> None:
    with patch("sentry.seer.similarity.config.SEER_GROUPING_NEXT_VERSION", GroupingVersion.V2_1):
        assert not should_send_to_seer_for_training(None)
