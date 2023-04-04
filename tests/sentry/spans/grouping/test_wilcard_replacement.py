import pytest

from sentry.spans.grouping.strategy.wildcard_replacement import glob_replace


@pytest.mark.parametrize(
    "source,rule,result",
    [
        (
            "/api/0/issues/sentry/details",
            "/api/0/issues/*/**",
            "/api/0/issues/*/details",
        ),
        (
            "/api/0/organizations/sentry/issues/",
            "/api/**/issues",
            "/api/0/organizations/sentry/issues/",
        ),
        (
            "/api/0/organizations/sentry/projects/javascript/info",
            "/api/0/organizations/*/projects/*/**",
            "/api/0/organizations/*/projects/*/info",
        ),
    ],
)
@pytest.mark.django_db
def test_glob_replace(source: str, rule: str, result) -> None:
    assert glob_replace(source, rule) == result
