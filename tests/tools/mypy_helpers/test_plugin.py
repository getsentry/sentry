from __future__ import annotations

import os.path
import subprocess
import sys
import tempfile

import pytest


def call_mypy(src: str, *, plugins: list[str] | None = None) -> tuple[int, str]:
    if plugins is None:
        plugins = ["tools.mypy_helpers.plugin"]
    with tempfile.TemporaryDirectory() as tmpdir:
        cfg = os.path.join(tmpdir, "mypy.toml")
        with open(cfg, "w") as f:
            f.write(f"[tool.mypy]\nplugins = {plugins!r}\n")

        ret = subprocess.run(
            (
                *(sys.executable, "-m", "mypy"),
                *("--config", cfg),
                *("-c", src),
            ),
            capture_output=True,
            encoding="UTF-8",
        )
        assert not ret.stderr
        return ret.returncode, ret.stdout


def test_invalid_get_connection_call():
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


def test_ok_get_connection():
    code = """
from django.db.transaction import get_connection

with get_connection("default") as cursor:
    cursor.execute("SELECT 1")
"""
    ret, out = call_mypy(code)
    assert ret == 0


def test_invalid_transaction_atomic():
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


def test_ok_transaction_atomic():
    code = """
from django.db import transaction

with transaction.atomic("default"):
    value = 10 / 2
"""
    ret, _ = call_mypy(code)
    assert ret == 0


def test_ok_transaction_on_commit():
    code = """
from django.db import transaction

def completed():
    pass

transaction.on_commit(completed, "default")
"""
    ret, _ = call_mypy(code)
    assert ret == 0


def test_invalid_transaction_on_commit():
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


def test_invalid_transaction_set_rollback():
    code = """
from django.db import transaction

transaction.set_rollback(True)
"""
    expected = """\
<string>:4: error: Missing positional argument "using" in call to "set_rollback"  [call-arg]
Found 1 error in 1 file (checked 1 source file)
"""
    ret, out = call_mypy(code)
    assert ret
    assert out == expected


def test_ok_transaction_set_rollback():
    code = """
from django.db import transaction

transaction.set_rollback(True, "default")
"""
    ret, _ = call_mypy(code)
    assert ret == 0


@pytest.mark.parametrize(
    "attr",
    (
        pytest.param("access", id="access from sentry.api.base"),
        pytest.param("auth", id="auth from sentry.middleware.auth"),
        pytest.param("csp_nonce", id="csp_nonce from csp.middleware"),
        pytest.param("is_sudo", id="is_sudo from sudo.middleware"),
        pytest.param("subdomain", id="subdomain from sentry.middleware.subdomain"),
        pytest.param("superuser", id="superuser from sentry.middleware.superuser"),
    ),
)
def test_added_http_request_attribute(attr: str) -> None:
    src = f"""\
from django.http.request import HttpRequest
x: HttpRequest
x.{attr}
"""
    ret, out = call_mypy(src, plugins=[])
    assert ret

    ret, out = call_mypy(src)
    assert ret == 0, (ret, out)
