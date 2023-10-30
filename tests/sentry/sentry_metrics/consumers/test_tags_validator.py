import pytest

from sentry.sentry_metrics.consumers.indexer.tags_validator import (
    GenericMetricsTagsValidator,
    ReleaseHealthTagsValidator,
)

common_cases = [
    pytest.param({"tag_key": "tag_value"}, True, id="within limits"),
    pytest.param(None, True, id="none tags"),
    pytest.param({}, True, id="empty tags"),
]


@pytest.mark.parametrize(
    "tags, expected_result",
    [
        *common_cases,
        pytest.param(
            {"k" * (ReleaseHealthTagsValidator.MAX_TAG_KEY_LENGTH + 1): "tag_value"},
            False,
            id="exceeds key length limit",
        ),
        pytest.param(
            {"tag_key": "v" * (ReleaseHealthTagsValidator.MAX_TAG_VALUE_LENGTH + 1)},
            False,
            id="exceeds value length limit",
        ),
    ],
)
def test_release_health_tags_limit_enforcer(tags, expected_result):
    assert ReleaseHealthTagsValidator().is_allowed(tags) == expected_result


@pytest.mark.parametrize(
    "tags, expected_result",
    [
        *common_cases,
        pytest.param(
            {"tag_key": "v" * GenericMetricsTagsValidator.MAX_TAG_VALUE_LENGTH},
            True,
            id="exact value limit",
        ),
        pytest.param(
            {"k" * (GenericMetricsTagsValidator.MAX_TAG_KEY_LENGTH + 1): "tag_value"},
            False,
            id="exceeds key length limit",
        ),
        pytest.param(
            {"tag_key": "v" * (GenericMetricsTagsValidator.MAX_TAG_VALUE_LENGTH + 1)},
            False,
            id="exceeds value length limit",
        ),
    ],
)
def test_generic_metrics_tags_limit_enforcer(tags, expected_result):
    assert GenericMetricsTagsValidator().is_allowed(tags) == expected_result
