from unittest.mock import Mock, patch

import pytest

from sentry.models.project import Project
from sentry.seer.similarity.config import (
    get_grouping_model_version,
    should_send_to_seer_for_training,
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
    ):
        assert get_grouping_model_version(project) == GroupingVersion.V2_1
        assert should_send_to_seer_for_training(project, training_model)


def test_no_duplicate_training(project: Project) -> None:
    with (
        patch("sentry.seer.similarity.config.SEER_GROUPING_STABLE_VERSION", GroupingVersion.V1),
        patch("sentry.seer.similarity.config.SEER_GROUPING_NEXT_VERSION", GroupingVersion.V2_1),
    ):
        assert not should_send_to_seer_for_training(project, "v2.1")


def test_no_training_when_next_model_is_stable(project: Project) -> None:
    with patch("sentry.seer.similarity.config.SEER_GROUPING_NEXT_VERSION", GroupingVersion.V2_1):
        assert not should_send_to_seer_for_training(project, None)
