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

        # stub for sentry.api.serializers.base.Serializer + free `serialize()` —
        # mirrors the runtime shape used by the autoderive hook. The free
        # function has overloads so we can verify end-to-end that an autoderived
        # `Serializer[T]` flows through to a typed return.
        api_dir = _fill_init_pyi(tmpdir, "sentry/api/serializers")
        with open(os.path.join(api_dir, "base.pyi"), "w") as f:
            f.write(
                "from collections.abc import Mapping, Sequence\n"
                "from typing import Any, Generic, TypeVar, overload\n"
                "T = TypeVar('T', default=Any)\n"
                "class Serializer(Generic[T]):\n"
                "    def serialize(self, obj: Any, attrs: Mapping[Any, Any], user: Any, **kwargs: Any) -> T: ...\n"
                "@overload\n"
                "def serialize(objects: Any, user: Any = ..., serializer: None = ..., **kwargs: Any) -> Any: ...\n"
                "@overload\n"
                "def serialize(objects: Sequence[Any], user: Any = ..., *, serializer: Serializer[T], **kwargs: Any) -> list[T]: ...\n"
                "@overload\n"
                "def serialize(objects: Sequence[Any], user: Any, serializer: Serializer[T], **kwargs: Any) -> list[T]: ...\n"
                "@overload\n"
                "def serialize(objects: object, user: Any = ..., *, serializer: Serializer[T], **kwargs: Any) -> T: ...\n"
                "@overload\n"
                "def serialize(objects: object, user: Any, serializer: Serializer[T], **kwargs: Any) -> T: ...\n"
            )
        with open(os.path.join(api_dir, "__init__.pyi"), "w") as f:
            f.write(
                "from sentry.api.serializers.base import Serializer as Serializer, serialize as serialize\n"
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


def test_response_union_dict_literal_narrows_to_typeddict_arm() -> None:
    """When the return is `Response[A] | Response[B]` (a union of TypedDicts),
    a dict-literal body that matches exactly one arm must narrow. mypy doesn't
    do this natively in union contexts — the plugin restores it."""
    src = """\
from typing import TypedDict
from rest_framework.response import Response

class FooResponse(TypedDict):
    x: int

class DetailResponse(TypedDict):
    detail: str

def typed() -> FooResponse:
    return {"x": 1}

def view() -> Response[FooResponse] | Response[DetailResponse]:
    return Response({"detail": "Not found"}, status=404)

def view_success() -> Response[FooResponse] | Response[DetailResponse]:
    return Response(typed())
"""
    ret, out = call_mypy(src)
    assert ret == 0, out


def test_response_union_dict_literal_wrong_shape_errors() -> None:
    """Plugin only narrows when exactly one arm accepts. A dict literal that
    matches no arm must still surface as a mypy error."""
    src = """\
from typing import TypedDict
from rest_framework.response import Response

class FooResponse(TypedDict):
    x: int

class DetailResponse(TypedDict):
    detail: str

def view() -> Response[FooResponse] | Response[DetailResponse]:
    return Response({"wrong": "shape"}, status=400)
"""
    ret, out = call_mypy(src)
    assert ret, out
    assert "Incompatible return value type" in out


def test_response_union_value_type_mismatch_errors() -> None:
    """`{"detail": 42}` is dict[str, int], not a valid `DetailResponse`
    (whose declared `detail: str`). Plugin must NOT narrow."""
    src = """\
from typing import TypedDict
from rest_framework.response import Response

class FooResponse(TypedDict):
    x: int

class DetailResponse(TypedDict):
    detail: str

def view() -> Response[FooResponse] | Response[DetailResponse]:
    return Response({"detail": 42}, status=400)
"""
    ret, out = call_mypy(src)
    assert ret, out


def test_response_union_extra_key_rejects() -> None:
    """A dict literal with extra keys beyond the TypedDict's fields does NOT
    satisfy the TypedDict — plugin must NOT narrow it."""
    src = """\
from typing import TypedDict
from rest_framework.response import Response

class FooResponse(TypedDict):
    x: int

class DetailResponse(TypedDict):
    detail: str

def view() -> Response[FooResponse] | Response[DetailResponse]:
    return Response({"detail": "x", "extra": "key"}, status=400)
"""
    ret, out = call_mypy(src)
    assert ret, out


def test_response_union_single_arm_unaffected() -> None:
    """Single-armed `Response[T]` is mypy's native bidirectional path. Plugin
    narrowing must not interfere."""
    src = """\
from typing import TypedDict
from rest_framework.response import Response

class DetailResponse(TypedDict):
    detail: str

def view() -> Response[DetailResponse]:
    return Response({"detail": "x"}, status=400)
"""
    ret, out = call_mypy(src)
    assert ret == 0, out


def test_response_union_no_typeddict_arms_unaffected() -> None:
    """If no union arm has a TypedDict T, plugin must not interfere."""
    src = """\
from rest_framework.response import Response

def view() -> Response[int] | Response[str]:
    return Response(42)
"""
    ret, out = call_mypy(src)
    assert ret == 0, out


def test_response_union_non_literal_body_unaffected() -> None:
    """Narrowing only fires on literal bodies. Variable/function-call bodies
    use mypy's standard flow — success arm matches via standard inference."""
    src = """\
from typing import TypedDict
from rest_framework.response import Response

class FooResponse(TypedDict):
    x: int

class DetailResponse(TypedDict):
    detail: str

def typed() -> FooResponse:
    return {"x": 1}

def view() -> Response[FooResponse] | Response[DetailResponse]:
    return Response(typed())
"""
    ret, out = call_mypy(src)
    assert ret == 0, out


def test_response_union_empty_list_narrows_to_list_arm() -> None:
    """`Response([])` should match any `Response[list[T]]` arm — empty list
    inhabits any element type. mypy infers `list[Never]` for `[]`, which
    doesn't match invariant `list[T]` without plugin help."""
    src = """\
from typing import TypedDict
from rest_framework.response import Response

class FooResponse(TypedDict):
    x: int

class DetailResponse(TypedDict):
    detail: str

def view() -> Response[list[FooResponse]] | Response[DetailResponse]:
    return Response([], status=200)
"""
    ret, out = call_mypy(src)
    assert ret == 0, out


def test_response_union_empty_dict_narrows_to_dict_arm() -> None:
    """`Response({})` should match `Response[dict[K, V]]` arms — empty dict
    inhabits any dict. mypy infers `dict[Never, Never]` for `{}`."""
    src = """\
from typing import TypedDict
from rest_framework.response import Response

class DetailResponse(TypedDict):
    detail: str

def view() -> Response[dict[int, int]] | Response[DetailResponse]:
    return Response({}, status=200)
"""
    ret, out = call_mypy(src)
    assert ret == 0, out


def test_response_union_name_agnostic_local_typeddict() -> None:
    """The plugin must narrow against ANY TypedDict arm — including locally-
    declared ones in the same file. It is NOT hardcoded to recognize specific
    names like `DetailResponse`."""
    src = """\
from typing import TypedDict
from rest_framework.response import Response

class FooResponse(TypedDict):
    x: int

class StatsPeriodErrorResponse(TypedDict):
    error: dict[str, str]

def view() -> Response[FooResponse] | Response[StatsPeriodErrorResponse]:
    return Response({"error": {"period": "invalid"}}, status=400)
"""
    ret, out = call_mypy(src)
    assert ret == 0, out


# -- Serializer auto-derive ----------------------------------------------------


def test_serializer_autoderive_typed_return() -> None:
    """`class Foo(Serializer):` with `serialize(...) -> Concrete` is promoted
    to `Serializer[Concrete]`, and the free `serialize(obj, user, FooSerializer())`
    overload resolves to `Concrete` instead of `Any`.
    """
    src = """\
from typing import Any, TypedDict
from collections.abc import Mapping
from sentry.api.serializers import Serializer, serialize

class FooResponse(TypedDict):
    name: str

class FooSerializer(Serializer):
    def serialize(self, obj: Any, attrs: Mapping[Any, Any], user: Any, **kwargs: Any) -> FooResponse:
        return {"name": "x"}

reveal_type(serialize(object(), None, FooSerializer()))
"""
    ret, out = call_mypy(src)
    assert ret == 0, out
    assert "FooResponse" in out


def test_serializer_autoderive_skipped_when_already_parameterized() -> None:
    """If the subclass already writes `Serializer[X]`, the hook is a no-op —
    no double-substitution, no clobbering of an explicit parameterization.
    """
    src = """\
from typing import Any, TypedDict
from collections.abc import Mapping
from sentry.api.serializers import Serializer, serialize

class FooResponse(TypedDict):
    name: str

class FooSerializer(Serializer[FooResponse]):
    def serialize(self, obj: Any, attrs: Mapping[Any, Any], user: Any, **kwargs: Any) -> FooResponse:
        return {"name": "x"}

reveal_type(serialize(object(), None, FooSerializer()))
"""
    ret, out = call_mypy(src)
    assert ret == 0, out
    assert "FooResponse" in out


def test_serializer_autoderive_skipped_when_serialize_unannotated() -> None:
    """An unannotated `serialize` keeps `T = Any` — we don't fabricate a type
    from a missing annotation.
    """
    src = """\
from sentry.api.serializers import Serializer, serialize

class FooSerializer(Serializer):
    def serialize(self, obj, attrs, user, **kwargs):
        return {"name": "x"}

reveal_type(serialize(object(), None, FooSerializer()))
"""
    ret, out = call_mypy(src)
    assert ret == 0, out
    assert 'Revealed type is "Any"' in out


def test_serializer_autoderive_denylist_entries_are_fully_qualified() -> None:
    """Sanity check on `_AUTODERIVE_DENYLIST`: every entry is a dotted module
    path (no bare class names, no typos like leading/trailing dots). End-to-end
    denylist behavior is exercised by the full mypy run on `src/` — each
    denylisted class corresponds to a known caller-drift case the plugin would
    otherwise surface as a CI failure.
    """
    from tools.mypy_helpers.serializer_autoderive import _AUTODERIVE_DENYLIST

    assert _AUTODERIVE_DENYLIST, "denylist should not be empty"
    for fullname in _AUTODERIVE_DENYLIST:
        assert "." in fullname, fullname
        assert not fullname.startswith("."), fullname
        assert not fullname.endswith("."), fullname
        # All Sentry serializers live under the `sentry.` namespace; this
        # catches typos that drop the package prefix.
        assert fullname.startswith("sentry."), fullname


def test_serializer_autoderive_skipped_when_serialize_returns_any() -> None:
    """Explicit `-> Any` is a deliberate opt-out — the hook respects it."""
    src = """\
from typing import Any
from collections.abc import Mapping
from sentry.api.serializers import Serializer, serialize

class FooSerializer(Serializer):
    def serialize(self, obj: Any, attrs: Mapping[Any, Any], user: Any, **kwargs: Any) -> Any:
        return {"name": "x"}

reveal_type(serialize(object(), None, FooSerializer()))
"""
    ret, out = call_mypy(src)
    assert ret == 0, out
    assert 'Revealed type is "Any' in out


def test_serializer_autoderive_typed_dict_remains_indexable() -> None:
    """An autoderived `Serializer[FooResponse]` (where FooResponse is a
    TypedDict) must produce a result that supports string-literal indexing —
    `o["key"]` — and iteration over a list of them must yield TypedDict items.
    Regression guard: an early implementation produced a TypedDict-via-typevar
    type that mypy refused to index.
    """
    src = """\
from typing import Any, TypedDict
from collections.abc import Mapping
from sentry.api.serializers import Serializer, serialize

class FooResponse(TypedDict):
    name: str
    id: str

class FooSerializer(Serializer):
    def serialize(self, obj: Any, attrs: Mapping[Any, Any], user: Any, **kwargs: Any) -> FooResponse:
        return {"name": "x", "id": "1"}

single = serialize(object(), None, FooSerializer())
n = single["name"]
reveal_type(n)

many = serialize([object()], None, FooSerializer())
keyed = {(o["id"], o["name"]): o for o in many}
reveal_type(keyed)
"""
    ret, out = call_mypy(src)
    assert ret == 0, out


def test_serializer_autoderive_resolves_forward_reference_in_serialize_return() -> None:
    """The `serialize()` return annotation can name a type defined *later* in
    the file (or in a `TYPE_CHECKING` block). At base-class-hook time, that
    name is an `UnboundType`; the hook routes it through `ctx.api.anal_type`
    so the resolved `Serializer[T]` ends up as a proper TypedDict, not a
    `Serializer[UnboundType("FooResponse")]` that mypy renders with `?` and
    refuses to index. Regression guard for the resolution path.
    """
    src = """\
from __future__ import annotations
from typing import Any, TypedDict
from collections.abc import Mapping
from sentry.api.serializers import Serializer, serialize

class FooSerializer(Serializer):
    def serialize(self, obj: Any, attrs: Mapping[Any, Any], user: Any, **kwargs: Any) -> FooResponse:
        return {"name": "x", "id": "1"}

class FooResponse(TypedDict):
    name: str
    id: str

result = serialize(object(), None, FooSerializer())
# If the forward reference was not resolved, `result` would be the unbound
# `FooResponse?` which mypy refuses to index — this line would error.
n = result["name"]
reveal_type(n)
"""
    ret, out = call_mypy(src)
    assert ret == 0, out
    # `n` is `str` (the TypedDict's declared value type) — proves the
    # forward reference resolved to a real `FooResponse` TypedDict.
    assert 'Revealed type is "str"' in out


def test_serializer_autoderive_propagates_through_subclass() -> None:
    """A subclass of an autoderived `Serializer[T]` inherits the derived `T`
    without needing its own `serialize` override.
    """
    src = """\
from typing import Any, TypedDict
from collections.abc import Mapping
from sentry.api.serializers import Serializer, serialize

class FooResponse(TypedDict):
    name: str

class FooSerializer(Serializer):
    def serialize(self, obj: Any, attrs: Mapping[Any, Any], user: Any, **kwargs: Any) -> FooResponse:
        return {"name": "x"}

class FancyFooSerializer(FooSerializer):
    pass

reveal_type(serialize(object(), None, FancyFooSerializer()))
"""
    ret, out = call_mypy(src)
    assert ret == 0, out
    assert "FooResponse" in out
