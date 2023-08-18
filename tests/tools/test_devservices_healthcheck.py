import time
from unittest import mock

import pytest

from tools.devservices_healthcheck import run_cmd


@pytest.fixture(autouse=True)
def no_sleep():
    with mock.patch.object(time, "sleep"):
        yield


def test_cmd_run_fail():
    with pytest.raises(SystemExit) as exinfo:
        run_cmd(["ls", "/tmp/there-is-nothing-here"], retries=1)
    assert exinfo.value.code != 0


def test_cmd_run_ok():
    run_cmd(["date"])
