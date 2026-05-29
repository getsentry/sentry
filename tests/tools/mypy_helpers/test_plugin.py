from __future__ import annotations

import os.path
import shutil
import subprocess
import sys
import tempfile

import pytest


def _fill_init_pyi(tmpdir: str, path: str) -> str:
    os.makedirs(os.path.join(tmpdir, path))
    for part in path.split(os.sep):
        tmpdir = os.path.join(tmpdir, part)
        open(os.path.join(tmpdir, "__init__.pyi"), "a").close()
    return tmpdir


def call_mypy(src: str, *, plugins: list[str] | None = None) -> tuple[int, str]:
    if plugins is None:
        plugins = ["tools.mypy_helpers.plugin"]
    with tempfile.TemporaryDirectory() as tmpdir:
        cfg = os.path.join(tmpdir, "mypy.toml")
        with open(cfg, "w") as f:
            f.write(f"[tool.mypy]\nplugins = {plugins!r}\n")

        # we stub several files in order to test our plugin
        # the tests cannot depend on sentry being importable (it isn't!)
        here = os.path.dirname(__file__)

        # stubs for lazy_service_wrapper
        utils_dir = _fill_init_pyi(tmpdir, "sentry/utils")
        sentry_src = os.path.join(here, "../../../src/sentry/utils/lazy_service_wrapper.py")
        shutil.copy(sentry_src, utils_dir)
        with open(os.path.join(utils_dir, "__init__.pyi"), "w") as f:
            f.write("from typing import Any\ndef __getattr__(k: str) -> Any: ...\n")

        # stubs for auth types
        auth_dir = _fill_init_pyi(tmpdir, "sentry/auth/services/auth")
        with open(os.path.join(auth_dir, "model.pyi"), "w") as f:
            f.write("class AuthenticatedToken: ...")

        # stub for rest_framework.response.Response — make it Generic[T] with a
        # body-less overload, mirroring fixtures/stubs-for-mypy/rest_framework/
        # response.pyi. The Response-body-Any plugin hook needs this shape to
        # see resolved T values.
        rf_dir = _fill_init_pyi(tmpdir, "rest_framework")
        with open(os.path.join(rf_dir, "response.pyi"), "w") as f:
            f.write(
                "from typing import Any, Generic, TypeVar, overload\n"
                "T = TypeVar('T', default=Any)\n"
                "class Response(Generic[T]):\n"
                "    @overload\n"
                "    def __init__(self, *, status: int | None = ...) -> None: ...\n"
                "    @overload\n"
                "    def __init__(self, data: T, status: int | None = ...) -> None: ...\n"
            )

        ret = subprocess.run(
            (
                *(sys.executable, "-m", "mypy"),
                *("--config", cfg),
                *("-c", src),
                "--show-traceback",
                # we only stub out limited parts of the sentry source tree
                "--ignore-missing-imports",
            ),
            env={**os.environ, "MYPYPATH": tmpdir},
            capture_output=True,
            encoding="UTF-8",
        )
        assert not ret.stderr
        return ret.returncode, ret.stdout


def test_invalid_get_connection_call() -> None:
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


def test_ok_get_connection() -> None:
    code = """
from django.db.transaction import get_connection

with get_connection("default") as cursor:
    cursor.execute("SELECT 1")
"""
    ret, out = call_mypy(code)
    assert ret == 0


def test_invalid_transaction_atomic() -> None:
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


def test_ok_transaction_atomic() -> None:
    code = """
from django.db import transaction

with transaction.atomic("default"):
    value = 10 / 2
"""
    ret, _ = call_mypy(code)
    assert ret == 0


def test_ok_transaction_on_commit() -> None:
    code = """
from django.db import transaction

def completed():
    pass

transaction.on_commit(completed, "default")
"""
    ret, _ = call_mypy(code)
    assert ret == 0


def test_invalid_transaction_on_commit() -> None:
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


def test_invalid_transaction_set_rollback() -> None:
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


def test_ok_transaction_set_rollback() -> None:
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


def test_adjusted_drf_request_auth() -> None:
    src = """\
from rest_framework.request import Request
x: Request
reveal_type(x.auth)
"""
    expected_no_plugins = """\
<string>:3: note: Revealed type is "rest_framework.authtoken.models.Token | Any"
Success: no issues found in 1 source file
"""
    expected_plugins = """\
<string>:3: note: Revealed type is "sentry.auth.services.auth.model.AuthenticatedToken | None"
Success: no issues found in 1 source file
"""
    ret, out = call_mypy(src, plugins=[])
    assert ret == 0
    assert out == expected_no_plugins

    ret, out = call_mypy(src)
    assert ret == 0
    assert out == expected_plugins


def test_csp_response_attribute() -> None:
    # technically undocumented -- django-csp's decorators usually do this
    src = """\
from django.http import HttpResponse
x: HttpResponse
x._csp_replace = {"inline-src": ["self"]}
"""
    expected = """\
<string>:3: error: "HttpResponse" has no attribute "_csp_replace"  [attr-defined]
Found 1 error in 1 file (checked 1 source file)
"""
    ret, out = call_mypy(src, plugins=[])
    assert ret == 1
    assert out == expected

    ret, out = call_mypy(src)
    assert ret == 0, (ret, out)


def test_lazy_service_wrapper() -> None:
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

    ret, out = call_mypy(src, plugins=[])
    assert ret
    assert out == expected

    ret, out = call_mypy(src)
    assert ret == 0


def test_base_cache_adjusted_version_type() -> None:
    src = """\
from django.core.cache import cache

cache.set(key='123', value='456', version='deadbeef')
"""

    expected = """\
<string>:3: error: Argument "version" to "set" of "BaseCache" has incompatible type "str"; expected "int | None"  [arg-type]
Found 1 error in 1 file (checked 1 source file)
"""

    ret, out = call_mypy(src, plugins=[])
    assert ret
    assert out == expected

    ret, out = call_mypy(src)
    assert ret == 0


def test_base_cache_incr_decr_version_removed() -> None:
    src = """\
from django.core.cache import cache

cache.incr_version('123')
"""

    expected = """\
<string>:3: error: removed method  [misc]
Found 1 error in 1 file (checked 1 source file)
"""

    ret, out = call_mypy(src, plugins=[])
    assert ret == 0

    ret, out = call_mypy(src)
    assert ret
    assert out == expected


def test_response_any_body_unparameterized_silent() -> None:
    """Bare `Response(any_value)` is the existing pattern across the codebase.
    The plugin must NOT fire on it — only parameterized usage."""
    src = """\
from typing import Any
from rest_framework.response import Response

def untyped() -> Any: ...

def view() -> Response:
    return Response(untyped())
"""
    ret, _ = call_mypy(src)
    assert ret == 0


def test_response_any_body_parameterized_errors() -> None:
    """`Response[Specific](untyped_call())` is the case the plugin closes —
    a parameterized return whose body is `Any` from an untyped serializer."""
    src = """\
from typing import Any, TypedDict
from rest_framework.response import Response

class Shape(TypedDict):
    a: int

def untyped() -> Any: ...

def view() -> Response[Shape]:
    return Response(untyped())
"""
    ret, out = call_mypy(src)
    assert ret, out
    assert "body is `Any`" in out


def test_response_typed_body_parameterized_silent() -> None:
    """Parameterized Response with a properly-typed body passes silently."""
    src = """\
from typing import TypedDict
from rest_framework.response import Response

class Shape(TypedDict):
    a: int

def typed() -> Shape:
    return {"a": 1}

def view() -> Response[Shape]:
    return Response(typed())
"""
    ret, out = call_mypy(src)
    assert ret == 0, out


def test_response_cast_escape_valve() -> None:
    """`cast(T, untyped_call())` is the sanctioned escape valve for untyped
    serializers — it should suppress the plugin error."""
    src = """\
from typing import Any, TypedDict, cast
from rest_framework.response import Response

class Shape(TypedDict):
    a: int

def untyped() -> Any: ...

def view() -> Response[Shape]:
    return Response(cast(Shape, untyped()))
"""
    ret, out = call_mypy(src)
    assert ret == 0, out


def test_response_body_less_parameterized_silent() -> None:
    """Error early-returns like `Response(status=404)` must keep working even
    when the enclosing function returns `Response[Specific]`."""
    src = """\
from typing import TypedDict
from rest_framework.response import Response

class Shape(TypedDict):
    a: int

def view(x: int) -> Response[Shape]:
    if x < 0:
        return Response(status=404)
    return Response({"a": x})
"""
    ret, out = call_mypy(src)
    assert ret == 0, out


def test_response_extra_key_drift_caught_by_core_mypy() -> None:
    """Core mypy (no plugin needed) catches dict-literal drift via TypedDict
    inference. Verify the plugin doesn't shadow this check."""
    src = """\
from typing import TypedDict
from rest_framework.response import Response

class Shape(TypedDict):
    a: int

def view() -> Response[Shape]:
    return Response({"a": 1, "extra": 2})
"""
    ret, out = call_mypy(src)
    assert ret, out
    assert 'Extra key "extra"' in out


def test_response_body_less_with_any_status_kwarg() -> None:
    """Regression: a body-less `Response(status=untyped())` call must NOT
    spuriously fire the body-Any plugin error. The first positional slot
    contains the status value, not a body."""
    src = """\
from typing import Any, TypedDict
from rest_framework.response import Response

class Shape(TypedDict):
    a: int

def get_status_code() -> Any:
    return 404

def view() -> Response[Shape]:
    return Response(status=get_status_code())
"""
    ret, out = call_mypy(src)
    assert ret == 0, out


def test_response_data_kwarg_with_any_value() -> None:
    """If `Response(data=untyped())` is used (kwarg form for the body), the
    plugin should still fire — `data` is the body name."""
    src = """\
from typing import Any, TypedDict
from rest_framework.response import Response

class Shape(TypedDict):
    a: int

def untyped() -> Any: ...

def view() -> Response[Shape]:
    return Response(data=untyped())
"""
    ret, out = call_mypy(src)
    assert ret, out
    assert "body is `Any`" in out


def test_response_any_body_async_view() -> None:
    """Async views return `Coroutine[..., Response[T]]`. The plugin must unwrap
    the Coroutine wrapper and still validate the inner Response body type."""
    src = """\
from typing import Any, TypedDict
from rest_framework.response import Response

class Shape(TypedDict):
    a: int

def untyped() -> Any: ...

async def view() -> Response[Shape]:
    return Response(untyped())
"""
    ret, out = call_mypy(src)
    assert ret, out
    assert "body is `Any`" in out


def test_response_typed_body_async_view_silent() -> None:
    """Async view with a properly-typed body passes silently."""
    src = """\
from typing import TypedDict
from rest_framework.response import Response

class Shape(TypedDict):
    a: int

def typed() -> Shape:
    return {"a": 1}

async def view() -> Response[Shape]:
    return Response(typed())
"""
    ret, out = call_mypy(src)
    assert ret == 0, out
