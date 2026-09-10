"""The serializer stub gives `validated_data` a declared shape.

Exercised through mypy under the repo's own config. If the stub ever stops being
found, `validated_data` falls back to `Any` and these cases would pass without
checking anything, so `test_stub_is_in_effect` guards that.
"""

from __future__ import annotations

import importlib.util
import os.path
import subprocess
import sys
import tempfile

import pytest

REPO = os.path.join(os.path.dirname(__file__), "..", "..", "..")

# The mypy config points django_settings_module at `sentry.conf.server_mypy`, so the django
# plugin cannot be constructed without the project installed and mypy exits before checking
# anything. `make test-tools` runs under a `uv sync --only-dev` env in CI, which is that case.
pytestmark = pytest.mark.skipif(
    importlib.util.find_spec("sentry") is None,
    reason="mypy's django plugin needs the sentry package for django_settings_module",
)

PRELUDE = """\
from typing import Any, NotRequired, TypedDict

from rest_framework import serializers


class MonitorData(TypedDict):
    name: NotRequired[str]
    threshold: NotRequired[int]


class MonitorValidator(serializers.Serializer[Any, MonitorData]):
    name = serializers.CharField()
    threshold = serializers.IntegerField()


class BareValidator(serializers.Serializer):
    anything = serializers.CharField()


class InstanceOnlyValidator(serializers.Serializer[MonitorData]):
    name = serializers.CharField()


def create_monitor(*, name: str = "", threshold: int = 0) -> None: ...
"""


def _check(body: str) -> str:
    """Type-check the prelude plus `body`, returning mypy's diagnostics."""
    with tempfile.TemporaryDirectory() as tmpdir:
        source = os.path.join(tmpdir, "case.py")
        with open(source, "w") as fh:
            fh.write(PRELUDE + body)
        proc = subprocess.run(
            (sys.executable, "-m", "mypy", "--no-incremental", source),
            capture_output=True,
            cwd=os.path.abspath(REPO),
        )
        out = proc.stdout.decode()
        return "\n".join(line for line in out.splitlines() if "case.py" in line)


def test_stub_is_in_effect() -> None:
    # Without the stub `validated_data` is Any, so returning it as int is fine
    # and every other case here would pass vacuously.
    out = _check("def f(v: MonitorValidator) -> int:\n    return v.validated_data['name']\n")
    assert "Incompatible return value type" in out


def test_declared_key_resolves_to_its_type() -> None:
    assert _check("def f(v: MonitorValidator) -> str:\n    return v.validated_data['name']\n") == ""


def test_misspelled_key_is_an_error() -> None:
    out = _check("def f(v: MonitorValidator) -> str:\n    return v.validated_data['nmae']\n")
    assert 'has no key "nmae"' in out


def test_value_type_is_checked_at_the_use_site() -> None:
    out = _check("def f(v: MonitorValidator) -> str:\n    return v.validated_data['threshold']\n")
    assert "Incompatible return value type" in out


def test_splat_into_a_typed_callable_is_checked() -> None:
    good = _check("def f(v: MonitorValidator) -> None:\n    create_monitor(**v.validated_data)\n")
    assert good == ""
    bad = _check(
        "class Other(TypedDict):\n"
        "    nope: NotRequired[bool]\n"
        "class OtherV(serializers.Serializer[Any, Other]):\n"
        "    nope = serializers.BooleanField()\n"
        "def f(v: OtherV) -> None:\n"
        "    create_monitor(**v.validated_data)\n"
    )
    assert "nope" in bad


def test_bare_subclass_is_unaffected() -> None:
    out = _check("def f(v: BareValidator) -> Any:\n    return v.validated_data['whatever']\n")
    assert out == ""


def test_existing_single_argument_subclass_still_resolves() -> None:
    out = _check("def f(v: InstanceOnlyValidator) -> Any:\n    return v.validated_data['any']\n")
    assert out == ""
