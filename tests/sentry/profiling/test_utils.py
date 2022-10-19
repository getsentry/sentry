from unittest import mock

import pytest
from django.conf import settings
from urllib3.connectionpool import ConnectionPool
from urllib3.exceptions import ConnectTimeoutError, MaxRetryError, ReadTimeoutError

from sentry.profiles.utils import RetrySkipTimeout  # type: ignore

DUMMY_POOL = ConnectionPool("dummy")


def get_url(path: str) -> str:
    return f"{settings.SENTRY_PROFILING_SERVICE_URL}{path}"


def test_retry_on_post_profile() -> None:
    """
    When it's a POST to /profile, we should retry on ReadTimeoutErrors up to the maximum allowed.
    """
    path = "/profile"
    error = ReadTimeoutError(DUMMY_POOL, path, "read timed out")
    retry = RetrySkipTimeout(total=3, allowed_methods={"POST"})
    retry = retry.increment(method="POST", url=get_url(path), error=error)
    retry = retry.increment(method="POST", url=get_url(path), error=error)
    retry = retry.increment(method="POST", url=get_url(path), error=error)
    with pytest.raises(MaxRetryError):
        retry.increment(method="POST", url=get_url(path), error=error)


def test_retry_on_other_route() -> None:
    """
    When it's NOT a POST to /profile, we should NOT retry on ReadTimeoutErrors.
    """
    path = f"/organizations/1/projects/1/profile/{'a' * 32}"
    error = ReadTimeoutError(DUMMY_POOL, path, "read timed out")
    retry = RetrySkipTimeout(total=3, allowed_methods={"GET"})
    with pytest.raises(ReadTimeoutError):
        retry.increment(method="GET", url=get_url(path), error=error)


@pytest.mark.parametrize(
    "path,normalized",
    [
        ("/organizations/1/filters", "/organizations/:orgId/filters"),
        ("/organizations/1/profiles", "/organizations/:orgId/profiles"),
        (
            "/organizations/1/projects/1/functions",
            "/organizations/:orgId/projects/:projId/functions",
        ),
        (
            f"/organizations/1/projects/1/profiles/{'a' * 32}",
            "/organizations/:orgId/projects/:projId/profiles/:uuid",
        ),
        (
            f"/organizations/1/projects/1/raw_profiles/{'a' * 32}",
            "/organizations/:orgId/projects/:projId/raw_profiles/:uuid",
        ),
        (
            f"/organizations/1/projects/1/transactions/{'a' * 32}",
            "/organizations/:orgId/projects/:projId/transactions/:uuid",
        ),
        ("/organizations/1/stats", "/organizations/:orgId/stats"),
        ("/organizations/1/transactions", "/organizations/:orgId/transactions"),
        ("/call_tree", "/call_tree"),
        ("/profile", "/profile"),
    ],
)
def test_retry_metric_normalizes_path(path: str, normalized: str) -> None:
    error = ConnectTimeoutError()
    retry = RetrySkipTimeout(total=3, allowed_methods={"GET"})
    with mock.patch("sentry.profiles.utils.metrics.incr") as incr:
        retry = retry.increment(method="GET", url=get_url(path), error=error)
        incr.assert_called_with(
            "profiling.client.retry", tags={"method": "GET", "path": normalized}
        )
