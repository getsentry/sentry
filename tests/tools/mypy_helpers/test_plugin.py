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


def test_field_descriptor_hack():
    code = """\
from __future__ import annotations

from django.db import models

class M1(models.Model):
    f: models.Field[int, int] = models.IntegerField()

class C:
    f: int

def f(inst: C | M1 | M2) -> int:
    return inst.f

# should also work with field subclasses
class F(models.Field[int, int]):
    pass

class M2(models.Model):
    f = F()

def g(inst: C | M2) -> int:
    return inst.f
"""

    # should be an error with default plugins
    # mypy may fix this at some point hopefully: python/mypy#5570
    ret, out = call_mypy(code, plugins=[])
    assert ret
    assert (
        out
        == """\
<string>:12: error: Incompatible return value type (got "Union[int, Field[int, int]]", expected "int")  [return-value]
<string>:22: error: Incompatible return value type (got "Union[int, F]", expected "int")  [return-value]
Found 2 errors in 1 file (checked 1 source file)
"""
    )

    # should be fixed with our special plugin
    ret, _ = call_mypy(code)
    assert ret == 0


def test_rest_framework_serializers_require_sequence():
    code = """\
from __future__ import annotations

from rest_framework import serializers

SOME_FSET = frozenset(('a', 'b', 'c'))
SOME_SET = {'a', 'b', 'c'}
SOME_TUPLE = ('a', 'b', 'c')
SOME_LIST = ['a', 'b', 'c']

# ok
serializers.ChoiceField(choices=SOME_TUPLE)
serializers.ChoiceField(choices=SOME_LIST)
serializers.MultipleChoiceField(choices=SOME_TUPLE)
serializers.MultipleChoiceField(choices=SOME_LIST)
# not ok
serializers.ChoiceField(choices=SOME_SET)
serializers.ChoiceField(choices=SOME_FSET)
serializers.MultipleChoiceField(choices=SOME_SET)
serializers.MultipleChoiceField(choices=SOME_FSET)
"""
    expected = """\
<string>:16: error: Argument "choices" to "ChoiceField" has incompatible type "Set[str]"; expected "Sequence[Any]"  [arg-type]
<string>:17: error: Argument "choices" to "ChoiceField" has incompatible type "FrozenSet[str]"; expected "Sequence[Any]"  [arg-type]
<string>:18: error: Argument "choices" to "MultipleChoiceField" has incompatible type "Set[str]"; expected "Sequence[Any]"  [arg-type]
<string>:19: error: Argument "choices" to "MultipleChoiceField" has incompatible type "FrozenSet[str]"; expected "Sequence[Any]"  [arg-type]
Found 4 errors in 1 file (checked 1 source file)
"""
    # should be ok without plugins
    ret, _ = call_mypy(code, plugins=[])
    assert ret == 0
    # should be an error with plugins
    ret, out = call_mypy(code)
    assert ret
    assert out == expected


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
