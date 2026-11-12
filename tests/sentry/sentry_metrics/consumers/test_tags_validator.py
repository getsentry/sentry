import pytest

from sentry.sentry_metrics.consumers.indexer.tags_validator import ReleaseHealthTagsValidator

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
def test_release_health_tags_limit_enforcer(
    tags: dict[str, str] | None, expected_result: bool
) -> None:
    assert ReleaseHealthTagsValidator().is_allowed(tags) == expected_result
