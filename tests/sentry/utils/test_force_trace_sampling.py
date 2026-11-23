from datetime import timedelta
from typing import Any
from unittest.mock import patch

import pytest
from django.test import override_settings

from sentry.testutils.helpers.datetime import freeze_time
from sentry.utils import sdk
from sentry.utils.force_trace_sampling import (
    COOKIE_NAME,
    MAX_AGE_SECONDS,
    create_grant_token,
    get_grant_remaining_ms,
    read_grant,
)


def environ(token: str) -> dict[str, str]:
    return {"PATH_INFO": "/issues/", "HTTP_COOKIE": f"other=1; {COOKIE_NAME}={token}"}


def test_sampler_forces_root_request() -> None:
    token, _ = create_grant_token(42)

    rate = sdk.traces_sampler({"wsgi_environ": environ(token), "parent_sampled": None})

    assert rate == 1.0


def test_sampler_keeps_unsampled_parent_decision() -> None:
    token, _ = create_grant_token(42)

    rate = sdk.traces_sampler({"wsgi_environ": environ(token), "parent_sampled": False})

    assert rate is False


@pytest.mark.parametrize(
    "context",
    [
        pytest.param({}, id="no-wsgi-environ"),
        pytest.param({"wsgi_environ": {"PATH_INFO": "/issues/"}}, id="no-cookies"),
        pytest.param({"wsgi_environ": environ("forged")}, id="forged-cookie"),
    ],
)
@override_settings(SENTRY_BACKEND_APM_SAMPLING=0.25)
def test_sampler_uses_default_rate_without_valid_grant(context: dict[str, Any]) -> None:
    assert sdk.traces_sampler({**context, "parent_sampled": None}) == 0.25


def test_sampler_does_not_read_the_options_store() -> None:
    """A query inside the sampler starts a root span, which calls the sampler again."""
    token, _ = create_grant_token(42)

    with patch("sentry.options.default_store.get") as get_from_store:
        sdk.traces_sampler({"wsgi_environ": environ(token), "parent_sampled": None})
        sdk.traces_sampler({"wsgi_environ": environ("forged"), "parent_sampled": None})

    get_from_store.assert_not_called()


def test_expired_grant_is_rejected() -> None:
    with freeze_time("2020-01-01 00:00:00") as frozen:
        token, _ = create_grant_token(42)
        assert read_grant(token) is not None

        frozen.shift(timedelta(seconds=MAX_AGE_SECONDS + 1))

        assert read_grant(token) is None


def test_remaining_time_counts_down() -> None:
    with freeze_time("2020-01-01 00:00:00") as frozen:
        token, _ = create_grant_token(42)
        grant = read_grant(token)
        assert grant is not None
        assert get_grant_remaining_ms(grant) == MAX_AGE_SECONDS * 1000

        frozen.shift(timedelta(seconds=60))

        assert get_grant_remaining_ms(grant) == (MAX_AGE_SECONDS - 60) * 1000
