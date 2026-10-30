import pytest
from django.utils.module_loading import import_string

from sentry.tsdb import resolve_backend
from sentry.tsdb.snuba import SnubaTSDB
from sentry.utils.warnings import DeprecatedSettingWarning


def test_legacy_backend_loads_snuba_tsdb() -> None:
    options = {
        "redis": {"cluster": "tsdb"},
        "switchover_timestamp": 0,
        "snuba": {"rollups": ((10, 360),)},
    }
    with pytest.warns(DeprecatedSettingWarning):
        path, resolved = resolve_backend("sentry.tsdb.redissnuba.RedisSnubaTSDB", options)

    tsdb = import_string(path)(**resolved)
    assert isinstance(tsdb, SnubaTSDB)
    assert tsdb.rollups == {10: 360}
