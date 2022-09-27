import pytest

from sentry.exceptions import InvalidSearchQuery
from sentry.profiles.utils import parse_profile_filters


@pytest.mark.parametrize(
    "query, error",
    [
        pytest.param("!version:1", "Invalid query: Illegal operator", id="illegal operator"),
        pytest.param("foo:bar", "Invalid query: foo is not supported", id="unsupported filter"),
        pytest.param("count():1", "Invalid query: Unknown filter", id="unknown filter"),
        pytest.param(
            "android_api_level:1 android_api_level:2",
            "Invalid query: Multiple filters for android_api_level",
            id="conflicting filters",
        ),
    ],
)
def test_parse_profiling_filters_errors(query, error):
    with pytest.raises(InvalidSearchQuery, match=error):
        parse_profile_filters(query)


@pytest.mark.parametrize(
    "query, expected",
    [
        pytest.param("", {}, id="empty query"),
        pytest.param("android_api_level:1", {"android_api_level": "1"}, id="one filter"),
        pytest.param(
            "android_api_level:1 device_classification:high",
            {"android_api_level": "1", "device_classification": "high"},
            id="two filters",
        ),
        pytest.param(
            "android_api_level:1 device_classification:high version:2 device_locale:en-US",
            {
                "android_api_level": "1",
                "device_classification": "high",
                "device_locale": "en-US",
                "version": "2",
            },
            id="multiple filters",
        ),
    ],
)
def test_parse_profiling_filters(query, expected):
    assert parse_profile_filters(query) == expected
