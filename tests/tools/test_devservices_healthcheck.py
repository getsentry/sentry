import pytest

from tools.devservices_healthcheck import run_cmd


def test_cmd_run_fail():
    with pytest.raises(SystemExit) as se:
        run_cmd(["i_dont_exist"], retries=1)
    assert se.value.code != 0


def test_cmd_run():
    assert 0 == run_cmd(["date"])
