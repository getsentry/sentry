from __future__ import annotations

import os.path
import subprocess
import sys


def test_stronglist() -> None:
    pyproject_path = os.path.join(os.path.dirname(__file__), "../../pyproject.toml")
    pyproject_path = os.path.relpath(pyproject_path)

    proc = subprocess.run(
        (sys.executable, "-uSm", "tools.mypy_helpers.check_stronglist", pyproject_path),
        check=False,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )
    if proc.returncode:
        raise AssertionError(f"\n\n{proc.stdout}")
