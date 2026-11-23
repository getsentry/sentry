from datetime import timedelta
from typing import Any

import pytest
from django.test import override_settings

from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.helpers.options import override_options
from sentry.utils import sdk
from sentry.utils.force_trace_sampling import (
    COOKIE_NAME,
    MAX_AGE_SECONDS,
    create_grant_token,
    read_grant,
)

ENABLED = {"tracing.force-sampling.enabled": True}


def environ(token: str) -> dict[str, str]:
    return {"PATH_INFO": "/issues/", "HTTP_COOKIE": f"other=1; {COOKIE_NAME}={token}"}


@override_options(ENABLED)
def test_sampler_forces_root_request() -> None:
    token, _ = create_grant_token(42)

    rate = sdk.traces_sampler({"wsgi_environ": environ(token), "parent_sampled": None})

    assert rate == 1.0


@override_options(ENABLED)
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
@override_options(ENABLED)
@override_settings(SENTRY_BACKEND_APM_SAMPLING=0.25)
def test_sampler_uses_default_rate_without_valid_grant(context: dict[str, Any]) -> None:
    assert sdk.traces_sampler({**context, "parent_sampled": None}) == 0.25


@override_options(ENABLED)
def test_expired_grant_is_rejected() -> None:
    with freeze_time("2020-01-01 00:00:00") as frozen:
        token, _ = create_grant_token(42)
        assert read_grant(token) is not None

        frozen.shift(timedelta(seconds=MAX_AGE_SECONDS + 1))

        assert read_grant(token) is None


def test_kill_switch_invalidates_existing_grants() -> None:
    with override_options(ENABLED):
        token, _ = create_grant_token(42)

    with override_options({"tracing.force-sampling.enabled": False}):
        assert read_grant(token) is None
