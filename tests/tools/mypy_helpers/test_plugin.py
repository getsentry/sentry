from __future__ import annotations

import pathlib
import subprocess
import sys
from typing import Callable

import pytest


@pytest.fixture
def call_mypy(tmp_path: pathlib.Path) -> Callable[[str], tuple[int, str]]:
    cfg = """\
[tool.mypy]
plugins = ["tools.mypy_helpers.plugin"]
"""
    cfg_path = tmp_path.joinpath("mypy.toml")
    cfg_path.write_text(cfg)

    def _call_mypy(contents: str) -> tuple[int, str]:
        ret = subprocess.run(
            (
                *(sys.executable, "-m", "mypy"),
                *("--config", str(cfg_path)),
                *("-c", contents),
            ),
            capture_output=True,
            encoding="UTF-8",
        )
        return ret.returncode, ret.stdout

    return _call_mypy


def test_invalid_get_connection_call(call_mypy):
    code = """
from django.db.transaction import get_connection

with get_connection() as cursor:
    cursor.execute("SELECT 1")
"""
    expected = """\
<string>:4: error: Missing positional argument "using" in call to "get_connection"  [call-arg]
Found 1 error in 1 file (checked 1 source file)
"""
    ret, out = call_mypy(code)
    assert ret
    assert out == expected


def test_ok_get_connection(call_mypy):
    code = """
from django.db.transaction import get_connection

with get_connection("default") as cursor:
    cursor.execute("SELECT 1")
"""
    ret, out = call_mypy(code)
    assert ret == 0


def test_invalid_transaction_atomic(call_mypy):
    code = """
from django.db import transaction

with transaction.atomic():
    value = 10 / 2
"""
    expected = """\
<string>:4: error: All overload variants of "atomic" require at least one argument  [call-overload]
<string>:4: note: Possible overload variants:
<string>:4: note:     def [_C] atomic(using: _C) -> _C
<string>:4: note:     def atomic(using: str, savepoint: bool = ..., durable: bool = ...) -> Atomic
Found 1 error in 1 file (checked 1 source file)
"""
    ret, out = call_mypy(code)
    assert ret
    assert out == expected


def test_ok_transaction_atomic(call_mypy):
    code = """
from django.db import transaction

with transaction.atomic("default"):
    value = 10 / 2
"""
    ret, _ = call_mypy(code)
    assert ret == 0


def test_ok_transaction_on_commit(call_mypy):
    code = """
from django.db import transaction

def completed():
    pass

transaction.on_commit(completed, "default")
"""
    ret, _ = call_mypy(code)
    assert ret == 0


def test_invalid_transaction_on_commit(call_mypy):
    code = """
from django.db import transaction

def completed():
    pass

transaction.on_commit(completed)
"""
    expected = """\
<string>:7: error: Missing positional argument "using" in call to "on_commit"  [call-arg]
Found 1 error in 1 file (checked 1 source file)
"""
    ret, out = call_mypy(code)
    assert ret
    assert out == expected
