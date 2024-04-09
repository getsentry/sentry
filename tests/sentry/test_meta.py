import os
import subprocess
import sys

from tests.sentry.utils import test_zip


def test_xdist_can_succeed() -> None:
    cmd = (sys.executable, "-mpytest", "-n2", "-qq", test_zip.__file__)
    env = {k: v for k, v in os.environ.items() if k != "DJANGO_SETTINGS_MODULE"}
    subprocess.check_call(cmd, env=env)
