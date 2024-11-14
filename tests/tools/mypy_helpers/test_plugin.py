from __future__ import annotations

import os.path
import pathlib
import shutil
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
<string>:4: note:     def [_C: Callable[..., Any]] atomic(using: _C) -> _C
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


def test_lazy_service_wrapper(tmp_path: pathlib.Path) -> None:
    src = """\
from typing import assert_type, Literal
from sentry.utils.lazy_service_wrapper import LazyServiceWrapper, Service, _EmptyType

class MyService(Service):
    X = "hello world"
    def f(self) -> int:
        return 5

backend = LazyServiceWrapper(MyService, "some.path", {})

# should proxy attributes properly
assert_type(backend.X, str)
assert_type(backend.f(), int)

# should represent self types properly
assert_type(backend._backend, str)
assert_type(backend._wrapped, _EmptyType | MyService)
"""

    expected = """\
<string>:12: error: Expression is of type "Any", not "str"  [assert-type]
<string>:13: error: Expression is of type "Any", not "int"  [assert-type]
Found 2 errors in 1 file (checked 1 source file)
"""

    # tools tests aren't allowed to import from `sentry` so we fixture
    # the particular source file we are testing
    utils_dir = tmp_path.joinpath("sentry/utils")
    utils_dir.mkdir(parents=True)

    here = os.path.dirname(__file__)
    sentry_src = os.path.join(here, "../../../src/sentry/utils/lazy_service_wrapper.py")
    shutil.copy(sentry_src, utils_dir)

    init_pyi = "from typing import Any\ndef __getattr__(self) -> Any: ...\n"
    utils_dir.joinpath("__init__.pyi").write_text(init_pyi)

    cfg = tmp_path.joinpath("mypy.toml")
    cfg.write_text("[tool.mypy]\nplugins = []\n")

    # can't use our helper above because we're fixturing sentry src, so mimic it here
    def _mypy() -> tuple[int, str]:
        ret = subprocess.run(
            (
                *(sys.executable, "-m", "mypy"),
                *("--config", cfg),
                # we only stub out limited parts of the sentry source tree
                "--ignore-missing-imports",
                *("-c", src),
            ),
            env={**os.environ, "MYPYPATH": str(tmp_path)},
            capture_output=True,
            encoding="UTF-8",
        )
        assert not ret.stderr
        return ret.returncode, ret.stdout

    ret, out = _mypy()
    assert ret
    assert out == expected

    cfg.write_text('[tool.mypy]\nplugins = ["tools.mypy_helpers.plugin"]\n')
    ret, out = _mypy()
    assert ret == 0
