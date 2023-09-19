import os
from typing import Tuple

from devenv.constants import venv_root
from devenv.lib import fs, proc
from devenv.lib_check.types import checker, fixer

tags = {"venv"}
name = "virtualenv"


@checker
def check() -> Tuple[bool, str]:
    try:
        proc.run_stream_output(
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
        )
    except RuntimeError as e:
        return False, f"{e}"
    return True, ""


@fixer
def fix() -> Tuple[bool, str]:
    try:
        proc.run_stream_output(
            ("devenv", "sync"),
            cwd=fs.gitroot(),
        )
    except RuntimeError as e:
        return False, f"{e}"
    return True, ""
