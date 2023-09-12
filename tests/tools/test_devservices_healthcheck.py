import subprocess
import time
from unittest import mock

import pytest

from tools.devservices_healthcheck import HealthcheckError, run_with_retries


@pytest.fixture(autouse=True)
def no_sleep():
    with mock.patch.object(time, "sleep"):
        yield


def test_run_with_retries_fail():
    with pytest.raises(HealthcheckError):
        run_with_retries(
            lambda: subprocess.run(("ls", "/tmp/this-does-not-exist"), check=True), 1, 10
        )


def test_run_with_retries_ok():
    run_with_retries(lambda: subprocess.run(("date"), check=True), 1, 10)
