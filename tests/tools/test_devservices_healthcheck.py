import pytest

from tools.devservices_healthcheck import run_cmd


def test_cmd_run_fail():
    with pytest.raises(SystemExit) as exinfo:
        run_cmd(["ls", "/tmp/there-is-nothing-here"], retries=1)
    assert exinfo.value.code != 0


def test_cmd_run_ok():
    try:
        run_cmd(["date"])
    except Exception as exp:
        assert False, f"run_cmd raised expcetion {exp}"
