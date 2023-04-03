import pytest

from sentry.spans.grouping.strategy.wildcard_replacement import glob_replace


@pytest.mark.parametrize(
    "source,rule,result",
    [
        (
            "GET /api/0/issues/sentry/details",
            "/api/0/issues/*/**",
            "/api/0/issues/*/details",
        ),
        (
            "GET /api/0/organizations/sentry/projects/javascript/info",
            "GET /api/0/organizations/*/projects/*/**",
            "GET /api/0/organizations/*/projects/*/info",
        ),
    ],
)
@pytest.mark.django_db
def test_wildcard_replacement(source: str, rule: str, result) -> None:
    assert glob_replace(source, rule) == result
