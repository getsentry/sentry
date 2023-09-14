import os
import subprocess
from typing import Tuple

from devenv.constants import venv_root
from devenv.lib import fs
from devenv.lib_check.types import checker, fixer

tags = {"venv"}
name = "virtualenv"


@checker
def check() -> Tuple[bool, str]:
    try:
        subprocess.run(
            (
                f"{venv_root}/sentry/bin/python3",
                "-c",
                """
from sentry.runner import configure; configure()
from django.conf import settings
from sentry.models import *
""",
            ),
            env={
                **os.environ,
                "SENTRY_SKIP_BACKEND_VALIDATION": "1",
            },
            check=True,
        )
    except FileNotFoundError as e:
        return False, f"{e}"
    except subprocess.CalledProcessError as e:
        return (
            False,
            f"`{e.cmd}` returned code {e.returncode}",
        )
    return True, ""


@fixer
def fix() -> Tuple[bool, str]:
    try:
        subprocess.run(
            ("devenv", "sync"),
            cwd=fs.gitroot(),
            check=True,
        )
    except FileNotFoundError as e:
        # This is reachable if the command isn't found.
        return False, f"{e}"
    except subprocess.CalledProcessError as e:
        return (
            False,
            f"`{e.cmd}` returned code {e.returncode}",
        )
    return True, ""
