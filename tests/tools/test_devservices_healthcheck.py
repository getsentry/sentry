from tools.devservices_healthcheck import run_cmd


def test_cmd_run_fail():
    result = run_cmd(["i_dont_exist"], retries=1)
    assert result != 0


def test_cmd_run():
    result = run_cmd(["date"])
    assert result == 0
