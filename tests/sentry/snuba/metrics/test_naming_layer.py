import re

import pytest

from sentry.snuba.metrics.naming_layer.mri import MRI_SCHEMA_REGEX
from sentry.snuba.metrics.naming_layer.public import PUBLIC_NAME_REGEX


@pytest.mark.parametrize(
    "name",
    [
        "session.duration",
        "session.all",
        "session.abnormal",
        "session.crashed",
        "session.crash_free_user_rate" "foo.bar.bar",
        "foo_bar.bar",
    ],
)
def test_valid_public_name_regex(name):
    matches = re.compile(rf"^{PUBLIC_NAME_REGEX}$").match(name)
    assert matches
    assert matches[0] == name


@pytest.mark.parametrize(
    "name",
    [
        "session.",
        ".session",
        "session..crashed",
        "..crashed",
        "e:sessions/error.preaggr@none",
        "e:sessions/crashed_abnormal@none",
        "e:sessions/user.crashed_abnormal@none",
        "session.09_crashed",
    ],
)
def test_invalid_public_name_regex(name):
    assert re.compile(rf"^{PUBLIC_NAME_REGEX}$").match(name) is None


@pytest.mark.parametrize(
    "name",
    [
        "e:sessions/error.preaggr@none",
        "e:sessions/crashed_abnormal@none",
        "e:sessions/user.crashed_abnormal@none",
        "e:sessions/healthy@",
        "e:sessions/healthy.crashed@",
        "e:sessions/healthy.crashed.crashed@",
        "e:sessions/healthy_crashed.crashed@",
        "e:sessions/healthy.crashed_crashed_sessions@",
        "d:transactions/measurements.frames_slow_rate@ratio",
        "c:sessions/session@none",
        "s:sessions/error@none",
        "g:sessions/error@none",
        "g:alerts/error@none",
        "g:custom/error@none",
        "g:issues/error@none",
        "c:errors/error@none",
    ],
)
def test_valid_mri_schema_regex(name):
    matches = re.compile(rf"^{MRI_SCHEMA_REGEX}$").match(name)
    assert matches
    assert matches[0] == name


@pytest.mark.parametrize(
    "name",
    [
        "e:sessions/healthy.@",
        "e:sessions/healthy..@",
        "e:sessions/healthy..crashed@",
        "e:sessions/.healthy@",
        "e:sessions/..healthy@",
        "e:sessions/healthy..crashed.crashed@",
        "t:sessions/error.preaggr@none",
        "e:foo/error.preaggr@none" "foo.bar",
        "e:sessions/error.098preaggr@none",
    ],
)
def test_invalid_mri_schema_regex(name):
    assert re.compile(rf"^{MRI_SCHEMA_REGEX}$").match(name) is None
