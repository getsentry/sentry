from __future__ import annotations

import ast
import os
from datetime import datetime, timezone
from unittest.mock import patch

from tools.api_guidelines.rules import ApiRule
from tools.flake8_plugin import (
    ApiInputViolation,
    S021_msg,
    S022_bare_msg,
    S022_missing_msg,
    S023_bad_path_msg,
    S023_blank_reason_msg,
    S023_ghost_msg,
    S023_no_reason_msg,
    S023_not_mapping_msg,
    S025_body_msg,
    S025_query_msg,
    S026_msg,
    S027_msg,
    S028_msg,
    S030_allowlist,
    S034_msg,
    SentryCheck,
    SentryVisitor,
    _s015_msg,
    get_api_violations,
)


def _run(src: str, filename: str = "getsentry/t.py") -> list[str]:
    tree = ast.parse(src)
    errors = sorted(SentryCheck(tree=tree, filename=filename).run())
    return ["t.py:{}:{}: {}".format(*error) for error in errors]


def _run_s030_allowlisted(src: str) -> list[str]:
    filename = "src/sentry/seer/test_legacy_caller.py"
    allowlist = {
        filename: {
            ("<module>", "import LlmGenerateRequest"): 1,
            ("<module>", "import make_llm_generate_request"): 1,
            ("legacy_caller", "call LlmGenerateRequest"): 1,
            ("legacy_caller", "call make_llm_generate_request"): 1,
        }
    }
    with patch.dict(S030_allowlist, allowlist, clear=True):
        return _run(src, filename=filename)


def test_S001() -> None:
    S001_py = """\
class A:
    def called_once():
        pass


A().called_once()
"""

    errors = _run(S001_py)
    assert errors == [
        "t.py:6:0: S001 Avoid using the called_once mock call as it is confusing and "
        "prone to causing invalid test behavior.",
    ]


def test_S002() -> None:
    S002_py = """\
print("print statements are not allowed")
"""

    errors = _run(S002_py)
    assert errors == ["t.py:1:0: S002 print functions or statements are not allowed."]


def test_S003() -> None:
    S003_py = """\
import json
import simplejson
from json import loads, load
from simplejson import JSONDecoder, JSONDecodeError, _default_encoder
import sentry.utils.json as good_json
from sentry.utils.json import JSONDecoder, JSONDecodeError
from .json import Validator


def bad_code():
    a = json.loads("''")
    b = simplejson.loads("''")
    c = loads("''")
    d = load()
"""

    errors = _run(S003_py)
    assert errors == [
        "t.py:1:0: S003 Use `from sentry.utils import json` instead.",
        "t.py:2:0: S003 Use `from sentry.utils import json` instead.",
        "t.py:3:0: S003 Use `from sentry.utils import json` instead.",
        "t.py:4:0: S003 Use `from sentry.utils import json` instead.",
    ]


def test_S004() -> None:
    S004_py = """\
import unittest
from something import func


class Test(unittest.TestCase):
    def test(self) -> None:
        with self.assertRaises(ValueError):
            func()
"""
    errors = _run(S004_py)
    assert errors == [
        "t.py:7:13: S004 Use `pytest.raises` instead for better debuggability.",
    ]


def test_S005() -> None:
    S005_py = """\
from sentry.models import User
"""
    errors = _run(S005_py)
    assert errors == [
        "t.py:1:0: S005 Do not import models from sentry.models but the actual module",
    ]


def test_S006() -> None:
    src = """\
from django.utils.encoding import force_bytes
from django.utils.encoding import force_str
"""
    # only error in tests until we can fix the rest
    assert _run(src, filename="src/sentry/whatever.py") == []
    errors = _run(src, filename="tests/test_foo.py")
    assert errors == [
        "t.py:1:0: S006 Do not use force_bytes / force_str -- test the types directly",
        "t.py:2:0: S006 Do not use force_bytes / force_str -- test the types directly",
    ]


def test_S007() -> None:
    src = """\
from sentry.testutils.outbox import outbox_runner
"""
    # no errors in tests/
    assert _run(src, filename="tests/test_foo.py") == []

    # no errors in src/sentry/testutils/
    assert _run(src, filename="src/sentry/testutils/silo.py") == []

    # errors in other paths
    errors = _run(src, filename="src/sentry/api/endpoints/organization_details.py")
    assert errors == [
        "t.py:1:0: S007 Do not import sentry.testutils into production code.",
    ]

    # Module imports should have errors too.
    src = """\
import sentry.testutils.outbox as outbox_utils
"""
    assert _run(src, filename="tests/test_foo.py") == []

    errors = _run(src, filename="src/sentry/api/endpoints/organization_details.py")
    assert errors == [
        "t.py:1:0: S007 Do not import sentry.testutils into production code.",
    ]


def test_s008() -> None:
    src = """\
from dateutil.parser import parse
"""
    # no errors in source
    assert _run(src, filename="src/sentry/example.py") == []

    # errors in tests
    tests1 = _run(src, filename="tests/test_example.py")
    tests2 = _run(src, filename="src/sentry/testutils/example.py")
    assert (
        tests1
        == tests2
        == ["t.py:1:0: S008 Use datetime.fromisoformat rather than guessing at date formats"]
    )


def test_S009() -> None:
    src = """\
try:
    ...
except OSError:
    raise  # ok: what we want people to do!
except TypeError as e:
    raise RuntimeError()  # ok: reraising a different exception
except ValueError as e:
    raise e  # bad!
"""
    expected = ["t.py:8:4: S009 Use `raise` with no arguments to reraise exceptions"]
    assert _run(src) == expected


def test_S010() -> None:
    src = """\
try:
    ...
except ValueError:
    ... # ok: not a reraise body
except Exception:
    raise  # bad!

try:
    ...
except Exception:
    ...
    raise  # ok: non just a reraise body
"""
    expected = ["t.py:5:0: S010 Except handler does nothing and should be removed"]
    assert _run(src) == expected


def test_S011() -> None:
    src = """\
from sentry.testutils.cases import APITestCase
from django.test import override_settings

def test() -> None:
    with override_settings(SENTRY_OPTIONS={"foo": "bar"}):  # bad
        ...

    with override_settings(
        SENTRY_OPTIONS={"foo": "bar"},  # bad
        OTHER_SETTING=2,  # ok
    ):
        ...

    with override_settings(OTHER_SETTING=2):  # ok
        ...

class Test(ApiTestCase):
    def test(self) -> None:
        with self.settings(SENTRY_OPTIONS={"foo": "bar"}):  # bad
            ...
"""
    expected = [
        "t.py:5:27: S011 Use override_options(...) instead to ensure proper cleanup",
        "t.py:9:8: S011 Use override_options(...) instead to ensure proper cleanup",
        "t.py:19:27: S011 Use override_options(...) instead to ensure proper cleanup",
    ]
    assert _run(src, filename="tests/test_example.py") == expected


def test_S031() -> None:
    src = """\
from django.conf import settings

def test(settings) -> None:
    settings.FOO = 1  # bad
    settings.FOO["a"] = 1  # bad
    settings.FOO["a"]["b"] += 1  # bad
    del settings.FOO  # bad
    del settings.FOO["a"]  # bad
    settings.lower = 1  # ok
    self.settings.FOO = 1  # ok
    foo = settings.FOO  # ok
"""
    msg = (
        "S031 Do not assign to settings in tests; use override_settings(...) or "
        "override_options(...) so the change is undone in order"
    )
    expected = [
        f"t.py:4:4: {msg}",
        f"t.py:5:4: {msg}",
        f"t.py:6:4: {msg}",
        f"t.py:7:8: {msg}",
        f"t.py:8:8: {msg}",
    ]
    assert _run(src, filename="tests/test_example.py") == expected
    assert _run(src, filename="src/sentry/conf/server.py") == []


def test_S012() -> None:
    src = """\
from rest_framework.permissions import BasePermission, IsAuthenticated, SAFE_METHODS
"""

    expected = [
        "t.py:1:0: S012 Use `from sentry.api.permissions import SentryIsAuthenticated` instead"
    ]
    assert _run(src) == expected


def test_S013() -> None:
    src = """\
from sentry.db.models.fields.array import ArrayField
"""
    expected = ["t.py:1:0: S013 Use `django.contrib.postgres.fields.array.ArrayField` instead"]
    assert _run(src) == expected


def test_S014() -> None:
    src = """\
def test(monkeypatch) -> None: pass
"""
    expected = ["t.py:1:9: S014 Use `unittest.mock` instead"]
    assert _run(src) == expected


def test_S016() -> None:
    # Direct import of ThreadPoolExecutor should be flagged
    src = "from concurrent.futures import ThreadPoolExecutor\n"
    errors = _run(src)
    assert errors == [
        "t.py:1:0: S016 Use `from sentry.utils.concurrent import ContextPropagatingThreadPoolExecutor`"
        " instead of `concurrent.futures.ThreadPoolExecutor` to ensure contextvars propagation.",
    ]

    # Importing ThreadPoolExecutor alongside other names should still be flagged
    src = "from concurrent.futures import ThreadPoolExecutor, as_completed\n"
    errors = _run(src)
    assert errors == [
        "t.py:1:0: S016 Use `from sentry.utils.concurrent import ContextPropagatingThreadPoolExecutor`"
        " instead of `concurrent.futures.ThreadPoolExecutor` to ensure contextvars propagation.",
    ]

    # Importing other names from concurrent.futures is fine
    src = "from concurrent.futures import as_completed, wait, Future\n"
    assert _run(src) == []

    # Importing from our wrapper is fine
    src = "from sentry.utils.concurrent import ContextPropagatingThreadPoolExecutor\n"
    assert _run(src) == []

    # Attribute access via `concurrent.futures.ThreadPoolExecutor()` should be flagged
    src = "import concurrent.futures\nconcurrent.futures.ThreadPoolExecutor(max_workers=4)\n"
    errors = _run(src)
    assert errors == [
        "t.py:2:0: S016 Use `from sentry.utils.concurrent import ContextPropagatingThreadPoolExecutor`"
        " instead of `concurrent.futures.ThreadPoolExecutor` to ensure contextvars propagation.",
    ]

    # Attribute access without call should also be flagged
    src = "import concurrent.futures\nx = concurrent.futures.ThreadPoolExecutor\n"
    errors = _run(src)
    assert errors == [
        "t.py:2:4: S016 Use `from sentry.utils.concurrent import ContextPropagatingThreadPoolExecutor`"
        " instead of `concurrent.futures.ThreadPoolExecutor` to ensure contextvars propagation.",
    ]

    # Other concurrent.futures attributes are fine
    src = "import concurrent.futures\nconcurrent.futures.as_completed([])\n"
    assert _run(src) == []


def test_S018() -> None:
    expected_msg = (
        "S018 Use `sentry.cache.backends.reconnectingmemcache.ReconnectingMemcache` "
        "instead of `django.core.cache.backends.memcached.PyMemcacheCache`."
    )

    src = """\
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.memcached.PyMemcacheCache",
        "LOCATION": ["127.0.0.1:11211"],
    }
}
"""
    errors = _run(src)
    assert errors == [f"t.py:3:19: {expected_msg}"]

    src = 'BACKEND = "django.core.cache.backends.memcached.PyMemcacheCache"\n'
    errors = _run(src)
    assert errors == [f"t.py:1:10: {expected_msg}"]

    src = "from django.core.cache.backends.memcached import PyMemcacheCache\n"
    errors = _run(src)
    assert errors == [f"t.py:1:0: {expected_msg}"]

    src = "from django.core.cache.backends.memcached import PyMemcacheCache, PyLibMCCache\n"
    errors = _run(src)
    assert errors == [f"t.py:1:0: {expected_msg}"]

    src = "from django.core.cache.backends.memcached import PyLibMCCache\n"
    assert _run(src) == []

    src = "from sentry.cache.backends.reconnectingmemcache import ReconnectingMemcache\n"
    assert _run(src) == []

    src = """\
CACHES = {
    "default": {
        "BACKEND": "sentry.cache.backends.reconnectingmemcache.ReconnectingMemcache",
    }
}
"""
    assert _run(src) == []

    src = '"PyMemcacheCache is a Django backend"\n'
    assert _run(src) == []


def test_S015_current_or_future_year() -> None:
    cy = datetime.now(timezone.utc).year
    msg = _s015_msg()
    # Current year at module scope is flagged
    assert _run(
        f"from datetime import datetime, timezone\n\n"
        f"X = datetime({cy}, 1, 1, tzinfo=timezone.utc)\n",
        filename="tests/x.py",
    ) == [f"t.py:3:0: {msg}"]
    # Future year at module scope is flagged
    assert _run(
        f"from datetime import datetime, timezone\n\n"
        f"X = datetime({cy + 1}, 1, 1, tzinfo=timezone.utc)\n",
        filename="tests/x.py",
    ) == [f"t.py:3:0: {msg}"]
    # Older year at module scope is allowed
    assert (
        _run(
            "from datetime import datetime, timezone\n\n"
            "X = datetime(2020, 1, 1, tzinfo=timezone.utc)\n",
            filename="tests/x.py",
        )
        == []
    )
    # Datetime inside function body is allowed
    assert (
        _run(
            f"def f():\n    x = datetime({cy}, 1, 1)\n",
            filename="tests/x.py",
        )
        == []
    )
    # freeze_time with current year is flagged
    assert _run(
        f"from freezegun import freeze_time\nfrom datetime import datetime, timezone\n\n"
        f"@freeze_time(datetime({cy}, 1, 1, tzinfo=timezone.utc))\n"
        f"def t():\n    pass\n",
        filename="tests/x.py",
    ) == [f"t.py:4:1: {msg}"]
    # freeze_time with future year is flagged
    assert _run(
        f"from freezegun import freeze_time\nfrom datetime import datetime, timezone\n\n"
        f"@freeze_time(datetime({cy + 1}, 1, 1, tzinfo=timezone.utc))\n"
        f"def t():\n    pass\n",
        filename="tests/x.py",
    ) == [f"t.py:4:1: {msg}"]
    # freeze_time with older year is allowed
    assert (
        _run(
            "from freezegun import freeze_time\nfrom datetime import datetime, timezone\n\n"
            "@freeze_time(datetime(2020, 1, 1, tzinfo=timezone.utc))\n"
            "def t():\n    pass\n",
            filename="tests/x.py",
        )
        == []
    )


def test_S019() -> None:
    src = """\
import logging

logger = logging.getLogger(__name__)

logger.info("m", extra={"name": 1})
logger.warning("m", extra={"message": "x"})
logger.info("m", extra={"ok_key": 1})
logger.info("m", extra=other)
"""
    expected = [
        "t.py:5:24: S019 'name' is a reserved LogRecord attribute; using it as a key in "
        "logging extra= raises KeyError at runtime",
        "t.py:6:27: S019 'message' is a reserved LogRecord attribute; using it as a key in "
        "logging extra= raises KeyError at runtime",
    ]
    assert _run(src) == expected


def test_S020() -> None:
    from tools.flake8_plugin import S020_msg

    eap_filename = "tests/snuba/api/endpoints/test_organization_events_x.py"
    src = """\
class OrganizationEventsEndpointTestBase:
    def client_get(self):
        return self.client.get("/ok")


class MyTest(OrganizationEventsEndpointTestBase):
    def test_bad(self):
        return self.client.get("/bad")

    def _do_request(self):
        return self.client.get("/also-bad")

    def client_get(self):
        return self.client.get("/allowed")
"""
    assert _run(src, filename=eap_filename) == [
        f"t.py:8:15: {S020_msg}",
        f"t.py:11:15: {S020_msg}",
    ]

    # Non-EAP suites / other paths stay quiet.
    assert _run(src, filename="tests/sentry/api/test_something.py") == []

    # Unrelated classes in an EAP path file are ignored.
    other = """\
class OtherTest:
    def test_ok(self):
        return self.client.get("/ok")
"""
    assert _run(other, filename=eap_filename) == []


S024_expected = (
    "S024 This module discovers .py files and parses them with ast, which is a "
    "linter built outside the two supported mechanisms. Single-file checks belong "
    "in tools/flake8_plugin.py as an S rule; checks that must resolve a name from "
    "another module belong in tools/mypy_helpers/plugin.py."
)


def test_S024_glob_and_parse() -> None:
    src = """\
import ast
from pathlib import Path


def lint(root):
    for path in Path(root).rglob("*.py"):
        tree = ast.parse(path.read_text())
        yield tree
"""
    assert _run(src) == [f"t.py:7:15: {S024_expected}"]


def test_S024_manual_suffix_filter_and_parse() -> None:
    src = """\
import ast
import os


def lint(root):
    for fname in os.listdir(root):
        if fname.endswith(".py"):
            yield ast.parse(open(fname).read())
"""
    assert _run(src) == [f"t.py:8:18: {S024_expected}"]


def test_S024_literal_eval_only_is_not_reported() -> None:
    src = """\
import ast


def decode(value):
    return ast.literal_eval(value)
"""
    assert _run(src) == []


def test_S024_parsing_a_supplied_string_is_not_reported() -> None:
    src = """\
import ast


def analyze(code: str):
    tree = ast.parse(code)
    return [n for n in ast.walk(tree)]
"""
    assert _run(src) == []


def test_S024_discovery_without_parsing_is_not_reported() -> None:
    src = """\
from pathlib import Path


def find(root):
    return list(Path(root).rglob("*.py"))
"""
    assert _run(src) == []


def test_S024_reports_once_per_module() -> None:
    src = """\
import ast
from pathlib import Path


def a(root):
    for p in Path(root).rglob("*.py"):
        yield ast.parse(p.read_text())


def b(root):
    for p in Path(root).glob("*.py"):
        yield ast.parse(p.read_text())
"""
    assert len(_run(src)) == 1


def test_S024_safelisted_module_is_not_reported() -> None:
    src = """\
import ast
from pathlib import Path


def squash(root):
    for p in Path(root).rglob("*.py"):
        yield ast.parse(p.read_text())
"""
    assert _run(src, filename="tools/migrations/squash.py") == []


def test_S024_stale_safelist_entry_is_reported() -> None:
    src = """\
def squash(root):
    return root
"""
    errors = _run(src, filename="tools/migrations/squash.py")
    assert errors == [
        "t.py:1:0: S024 stale safelist entry: this module no longer discovers and "
        "parses .py files. Remove it from S024_safelist."
    ]


def test_S029_rejects_raw_seer_pool_request() -> None:
    src = """\
from django.conf import settings
from sentry.net.http import connection_from_url

seer_pool = connection_from_url(settings.SEER_AUTOFIX_URL)
seer_pool.urlopen("POST", "/v1/example")
"""

    assert _run(src, filename="src/sentry/example.py") == [
        "t.py:5:0: S029 Seer connection pools must use make_signed_seer_api_request; "
        "raw urlopen bypasses ViewerContext propagation"
    ]


def test_S029_allows_central_seer_transport() -> None:
    src = """\
from django.conf import settings
from sentry.net.http import connection_from_url
from sentry.seer.signed_seer_api import make_signed_seer_api_request

seer_pool = connection_from_url(settings.SEER_AUTOFIX_URL)
make_signed_seer_api_request(seer_pool, "/v1/example", b"{}")
"""

    assert _run(src, filename="src/sentry/example.py") == []


def test_S029_ignores_non_seer_pool() -> None:
    src = """\
from sentry.net.http import connection_from_url

pool = connection_from_url("https://example.com")
pool.urlopen("GET", "/")
"""

    assert _run(src, filename="src/sentry/example.py") == []


def test_S030_allows_exact_legacy_callsite_baseline() -> None:
    src = """\
from sentry.seer.signed_seer_api import LlmGenerateRequest, make_llm_generate_request


def legacy_caller():
    body = LlmGenerateRequest(prompt="hello")
    return make_llm_generate_request(body)
"""

    assert _run_s030_allowlisted(src) == []


def test_S030_rejects_new_legacy_caller() -> None:
    src = """\
from sentry.seer.signed_seer_api import LlmGenerateRequest, make_llm_generate_request


def new_caller():
    body = LlmGenerateRequest(prompt="hello")
    return make_llm_generate_request(body)
"""

    errors = _run(src, filename="src/sentry/seer/new_caller.py")
    assert len(errors) == 4
    assert all("S030 Do not add new callers" in error for error in errors)


def test_S030_rejects_second_call_in_allowlisted_function() -> None:
    src = """\
from sentry.seer.signed_seer_api import LlmGenerateRequest, make_llm_generate_request


def legacy_caller():
    first = LlmGenerateRequest(prompt="first")
    second = LlmGenerateRequest(prompt="second")
    make_llm_generate_request(first)
    return make_llm_generate_request(second)
"""

    errors = _run_s030_allowlisted(src)
    assert errors == [
        "t.py:6:13: S030 Do not add new callers of the legacy Seer LLM generate API; "
        "add a named Seer one-shot so prompts and model selection stay in Seer",
        "t.py:8:11: S030 Do not add new callers of the legacy Seer LLM generate API; "
        "add a named Seer one-shot so prompts and model selection stay in Seer",
    ]


def test_S030_rejects_aliased_and_module_qualified_calls() -> None:
    aliased = """\
from sentry.seer.signed_seer_api import LlmGenerateRequest as LegacyRequest

LegacyRequest(prompt="hello")
"""
    module_qualified = """\
import sentry.seer.signed_seer_api as seer_api

seer_api.make_llm_generate_request({})
"""

    assert len(_run(aliased, filename="src/sentry/example.py")) == 2
    assert len(_run(module_qualified, filename="src/sentry/example.py")) == 2


def test_S030_rejects_direct_route_bypass() -> None:
    src = 'make_signed_seer_api_request(pool, "/v1/llm/generate", b"{}")\n'

    assert _run(src, filename="src/sentry/example.py") == [
        "t.py:1:35: S030 Do not add new callers of the legacy Seer LLM generate API; "
        "add a named Seer one-shot so prompts and model selection stay in Seer"
    ]


def test_S030_reports_stale_allowlist_entry() -> None:
    src = """\
from sentry.seer.signed_seer_api import LlmGenerateRequest, make_llm_generate_request


def legacy_caller():
    return None
"""

    errors = _run_s030_allowlisted(src)
    assert len(errors) == 2
    assert all("S030 stale legacy Seer LLM generate allowlist entry" in error for error in errors)


def test_S030_allows_legacy_api_definition() -> None:
    src = """\
class LlmGenerateRequest: ...

def make_llm_generate_request(body):
    return make_signed_seer_api_request(pool, "/v1/llm/generate", body)
"""

    assert _run(src, filename="src/sentry/seer/signed_seer_api.py") == []


def _codes(src: str) -> list[str]:
    """`line:CODE` for each diagnostic, for terse assertions."""
    tree = ast.parse(src)
    out = []
    for line, _col, msg, _cls in sorted(SentryCheck(tree=tree, filename="t.py").run()):
        out.append(f"{line}:{msg.split(' ', 1)[0]}")
    return out


_RESP_HEADER = """\
from __future__ import annotations
from typing import Optional, TypedDict, Union
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework.response import Response
from rest_framework import response
from django.http.response import HttpResponseBase, StreamingHttpResponse
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.apidocs.constants import RESPONSE_BAD_REQUEST

class AResponse(TypedDict):
    a: str

class BResponse(TypedDict):
    b: str

class DetailResponse(TypedDict):
    detail: str

"""


_RESP_OFFSET = _RESP_HEADER.count("\n")


def _resp(body: str) -> list[str]:
    """Diagnostics for `body`, with line numbers relative to `body`."""
    out = []
    for entry in _codes(_RESP_HEADER + body):
        line, code = entry.split(":")
        out.append(f"{int(line) - _RESP_OFFSET}:{code}")
    return out


# --- S021: decorator T must appear in the annotation ---


def test_S021_matching_decorator_and_annotation_passes() -> None:
    assert (
        _resp("""\
class E:
    @extend_schema(responses={200: inline_sentry_response_serializer("A", AResponse)})
    def get(self) -> Response[AResponse]: ...
""")
        == []
    )


def test_S021_mismatch_fires() -> None:
    assert _resp("""\
class E:
    @extend_schema(responses={200: inline_sentry_response_serializer("A", AResponse)})
    def get(self) -> Response[BResponse]: ...
""") == ["3:S021"]


def test_S021_unmigrated_bare_annotation_skipped() -> None:
    assert (
        _resp("""\
class E:
    @extend_schema(responses={200: inline_sentry_response_serializer("A", AResponse)})
    def get(self) -> Response: ...
""")
        == []
    )


def test_S021_method_without_extend_schema_skipped() -> None:
    assert (
        _resp("""\
class E:
    def get(self) -> Response[AResponse]: ...
""")
        == []
    )


def test_S021_canned_response_constant_skipped() -> None:
    assert (
        _resp("""\
class E:
    @extend_schema(responses={400: RESPONSE_BAD_REQUEST})
    def get(self) -> Response[AResponse]: ...
""")
        == []
    )


def test_S021_direct_serializer_class_reference_skipped() -> None:
    assert (
        _resp("""\
class E:
    @extend_schema(responses={200: AResponse})
    def get(self) -> Response[BResponse]: ...
""")
        == []
    )


def test_S021_openapi_response_wrapper_skipped() -> None:
    assert (
        _resp("""\
class E:
    @extend_schema(responses={200: OpenApiResponse(description="x")})
    def get(self) -> Response[BResponse]: ...
""")
        == []
    )


def test_S021_union_annotation_matches_multi_status_decorator() -> None:
    assert (
        _resp("""\
class E:
    @extend_schema(responses={
        200: inline_sentry_response_serializer("A", AResponse),
        400: inline_sentry_response_serializer("B", BResponse),
    })
    def get(self) -> Response[AResponse] | Response[BResponse]: ...
""")
        == []
    )


def test_S021_union_annotation_missing_decorator_T_fires() -> None:
    assert _resp("""\
class E:
    @extend_schema(responses={
        200: inline_sentry_response_serializer("A", AResponse),
        400: inline_sentry_response_serializer("B", BResponse),
    })
    def get(self) -> Response[AResponse] | Response[DetailResponse]: ...
""") == ["6:S021"]


def test_S021_annotation_with_extra_T_passes() -> None:
    assert (
        _resp("""\
class E:
    @extend_schema(responses={200: inline_sentry_response_serializer("A", AResponse)})
    def get(self) -> Response[AResponse] | Response[DetailResponse]: ...
""")
        == []
    )


def test_S021_union_with_non_response_arm_skipped() -> None:
    assert (
        _resp("""\
class E:
    @extend_schema(responses={200: inline_sentry_response_serializer("A", AResponse)})
    def get(self) -> Response[BResponse] | StreamingHttpResponse: ...
""")
        == []
    )


def test_S021_async_method_works() -> None:
    assert _resp("""\
class E:
    @extend_schema(responses={200: inline_sentry_response_serializer("A", AResponse)})
    async def get(self) -> Response[BResponse]: ...
""") == ["3:S021"]


def test_S021_dotted_response_annotation_handled() -> None:
    assert _resp("""\
class E:
    @extend_schema(responses={200: inline_sentry_response_serializer("A", AResponse)})
    def get(self) -> response.Response[BResponse]: ...
""") == ["3:S021"]


def test_S021_opaque_error_constant_with_typed_error_arm_passes() -> None:
    assert (
        _resp("""\
class E:
    @extend_schema(responses={
        200: inline_sentry_response_serializer("A", AResponse),
        400: RESPONSE_BAD_REQUEST,
    })
    def get(self) -> Response[AResponse] | Response[DetailResponse]: ...
""")
        == []
    )


def test_S021_is_name_agnostic_about_typeddicts() -> None:
    assert (
        _resp("""\
class E:
    @extend_schema(responses={200: inline_sentry_response_serializer("A", AResponse)})
    def get(self) -> Response[AResponse]: ...

class F:
    @extend_schema(responses={200: inline_sentry_response_serializer("Whatever", BResponse)})
    def get(self) -> Response[BResponse]: ...
""")
        == []
    )


# --- S034: a 4xx returned inline must be a key in responses= ---


def test_S034_undocumented_status_constant_fires() -> None:
    assert _resp("""\
class E:
    @extend_schema(responses={200: AResponse})
    def post(self) -> Response[AResponse]:
        return Response({"detail": "x"}, status=status.HTTP_409_CONFLICT)
""") == ["4:S034"]


def test_S034_undocumented_literal_status_fires() -> None:
    assert _resp("""\
class E:
    @extend_schema(responses={200: AResponse})
    def post(self) -> Response[AResponse]:
        return Response({"detail": "x"}, 402)
""") == ["4:S034"]


def test_S034_bare_status_name_fires() -> None:
    assert _resp("""\
class E:
    @extend_schema(responses={200: AResponse})
    def post(self) -> Response[AResponse]:
        return Response(status=HTTP_404_NOT_FOUND)
""") == ["4:S034"]


def test_S034_documented_status_passes() -> None:
    assert (
        _resp("""\
class E:
    @extend_schema(responses={200: AResponse, 409: RESPONSE_CONFLICT})
    def post(self) -> Response[AResponse]:
        if self.x:
            return Response({"detail": "x"}, status=status.HTTP_409_CONFLICT)
        return Response({"a": "a"}, status=200)
""")
        == []
    )


def test_S034_tuple_and_string_keys_count_as_documented() -> None:
    assert (
        _resp("""\
class E:
    @extend_schema(responses={(400, "application/json"): RESPONSE_BAD_REQUEST, "404": X})
    def post(self) -> Response[AResponse]:
        if self.x:
            return Response(status=400)
        return Response(status=404)
""")
        == []
    )


def test_S034_non_4xx_statuses_skipped() -> None:
    assert (
        _resp("""\
class E:
    @extend_schema(responses={200: AResponse})
    def post(self) -> Response[AResponse]:
        if self.x:
            return Response(status=status.HTTP_202_ACCEPTED)
        return Response(status=500)
""")
        == []
    )


def test_S034_method_without_responses_skipped() -> None:
    assert (
        _resp("""\
class E:
    @extend_schema(operation_id="x")
    def post(self) -> Response[AResponse]:
        return Response(status=409)
""")
        == []
    )


def test_S034_unreadable_responses_skipped() -> None:
    assert (
        _resp("""\
class E:
    @extend_schema(responses=SHARED_RESPONSES)
    def post(self) -> Response[AResponse]:
        return Response(status=409)

    @extend_schema(responses={200: AResponse, **SHARED_ERRORS})
    def put(self) -> Response[AResponse]:
        return Response(status=409)

    @extend_schema(responses={OK: AResponse})
    def delete(self) -> Response[AResponse]:
        return Response(status=409)
""")
        == []
    )


def test_S034_helpers_variables_and_raises_not_followed() -> None:
    assert (
        _resp("""\
class E:
    @extend_schema(responses={200: AResponse})
    def post(self) -> Response[AResponse]:
        if self.a:
            return self.helper()
        if self.b:
            raise Conflict()
        response = Response(status=409)
        return response
""")
        == []
    )


def test_S034_nested_function_return_not_attributed() -> None:
    assert (
        _resp("""\
class E:
    @extend_schema(responses={200: AResponse})
    def post(self) -> Response[AResponse]:
        def inner():
            return Response(status=409)

        return inner()
""")
        == []
    )


def test_S034_async_method_and_dotted_response_fire() -> None:
    assert _resp("""\
class E:
    @extend_schema(responses={200: AResponse})
    async def post(self) -> Response[AResponse]:
        return response.Response(status=status.HTTP_402_PAYMENT_REQUIRED)
""") == ["4:S034"]


def test_S034_module_level_function_skipped() -> None:
    assert (
        _resp("""\
@extend_schema(responses={200: AResponse})
def post(request) -> Response[AResponse]:
    return Response(status=409)
""")
        == []
    )


def test_S034_message_names_the_status() -> None:
    tree = ast.parse("""\
class E:
    @extend_schema(responses={200: AResponse})
    def post(self) -> Response[AResponse]:
        return Response(status=409)
""")
    ((_line, _col, msg, _cls),) = SentryCheck(tree=tree, filename="t.py").run()
    assert msg == S034_msg.format(409)


# --- S022: published methods must declare a response shape ---


def test_S022_public_experimental_bare_response_fires() -> None:
    assert _resp("""\
class E:
    publish_status = {"GET": ApiPublishStatus.PUBLIC_EXPERIMENTAL}
    def get(self) -> Response: ...
""") == ["3:S022"]


def test_S022_public_experimental_missing_annotation_fires() -> None:
    assert _resp("""\
class E:
    publish_status = {"GET": ApiPublishStatus.PUBLIC_EXPERIMENTAL}
    def get(self): ...
""") == ["3:S022"]


def test_S022_experimental_is_not_published_and_does_not_fire() -> None:
    assert (
        _resp("""\
class E:
    publish_status = {"GET": ApiPublishStatus.EXPERIMENTAL}
    def get(self) -> Response: ...
""")
        == []
    )


def test_S022_public_bare_response_fires() -> None:
    assert _resp("""\
class E:
    publish_status = {"GET": ApiPublishStatus.PUBLIC}
    def get(self) -> Response: ...
""") == ["3:S022"]


def test_S022_public_missing_annotation_fires() -> None:
    assert _resp("""\
class E:
    publish_status = {"GET": ApiPublishStatus.PUBLIC}
    def get(self): ...
""") == ["3:S022"]


def test_S022_public_typed_response_passes() -> None:
    assert (
        _resp("""\
class E:
    publish_status = {"GET": ApiPublishStatus.PUBLIC}
    def get(self) -> Response[AResponse]: ...
""")
        == []
    )


def test_S022_public_union_of_response_arms_passes() -> None:
    assert (
        _resp("""\
class E:
    publish_status = {"GET": ApiPublishStatus.PUBLIC}
    def get(self) -> Response[AResponse] | Response[DetailResponse]: ...
""")
        == []
    )


def test_S022_public_non_drf_response_passes() -> None:
    assert (
        _resp("""\
class E:
    publish_status = {"GET": ApiPublishStatus.PUBLIC}
    def get(self) -> HttpResponseBase: ...
""")
        == []
    )


def test_S022_public_typed_response_with_streaming_arm_passes() -> None:
    assert (
        _resp("""\
class E:
    publish_status = {"GET": ApiPublishStatus.PUBLIC}
    def get(self) -> Response[AResponse] | StreamingHttpResponse: ...
""")
        == []
    )


def test_S022_private_bare_response_does_not_fire() -> None:
    assert (
        _resp("""\
class E:
    publish_status = {"GET": ApiPublishStatus.PRIVATE}
    def get(self) -> Response: ...
""")
        == []
    )


def test_S022_method_outside_publish_status_does_not_fire() -> None:
    assert (
        _resp("""\
class E:
    publish_status = {"GET": ApiPublishStatus.PUBLIC}
    def post(self) -> Response: ...
""")
        == []
    )


def test_S022_class_without_publish_status_skipped() -> None:
    assert (
        _resp("""\
class E:
    def get(self) -> Response: ...
""")
        == []
    )


def test_S022_annotated_publish_status_detected() -> None:
    assert _resp("""\
class E:
    publish_status: dict[str, ApiPublishStatus] = {"GET": ApiPublishStatus.PUBLIC}
    def get(self) -> Response: ...
""") == ["3:S022"]


def test_S022_bare_response_in_typing_union_fires() -> None:
    assert _resp("""\
class E:
    publish_status = {"GET": ApiPublishStatus.PUBLIC}
    def get(self) -> Union[Response, None]: ...
""") == ["3:S022"]


def test_S022_bare_response_in_optional_fires() -> None:
    assert _resp("""\
class E:
    publish_status = {"GET": ApiPublishStatus.PUBLIC}
    def get(self) -> Optional[Response]: ...
""") == ["3:S022"]


def test_S022_optional_of_typed_response_passes() -> None:
    assert (
        _resp("""\
class E:
    publish_status = {"GET": ApiPublishStatus.PUBLIC}
    def get(self) -> Optional[Response[AResponse]]: ...
""")
        == []
    )


def test_S022_typing_union_of_typed_response_passes() -> None:
    assert (
        _resp("""\
class E:
    publish_status = {"GET": ApiPublishStatus.PUBLIC}
    def get(self) -> Union[Response[AResponse], Response[DetailResponse]]: ...
""")
        == []
    )


def test_S022_non_http_method_is_exempt() -> None:
    assert (
        _resp("""\
class E:
    publish_status = {"GET": ApiPublishStatus.PUBLIC}
    def helper(self) -> Response: ...
    def get(self) -> Response[AResponse]: ...
""")
        == []
    )


def test_S022_nested_class_method_is_not_checked() -> None:
    assert (
        _resp("""\
class Outer:
    publish_status = {"GET": ApiPublishStatus.PUBLIC}
    class Inner:
        publish_status = {"GET": ApiPublishStatus.PUBLIC}
        def get(self) -> Response: ...
""")
        == []
    )


_OMIT_HEADER = """\
from typing import TypedDict
from drf_spectacular.utils import extend_schema_serializer
from rest_framework import serializers
from sentry.apidocs.omissions import sentry_schema_serializer

"""
_OMIT_OFFSET = _OMIT_HEADER.count("\n")


def _omit(body: str) -> list[str]:
    out = []
    for entry in _codes(_OMIT_HEADER + body):
        line, code = entry.split(":")
        out.append(f"{int(line) - _OMIT_OFFSET}:{code}")
    return out


# --- S023: schema omissions must carry a stated reason ---


def test_S023_bare_exclude_fields_rejected() -> None:
    assert _omit("""\
@extend_schema_serializer(exclude_fields=["secret"])
class S(serializers.Serializer):
    secret = serializers.CharField()
""") == ["1:S023"]


def test_S023_string_valued_exclude_fields_rejected() -> None:
    assert _omit("""\
@extend_schema_serializer(exclude_fields="secret")
class S(serializers.Serializer):
    secret = serializers.CharField()
""") == ["1:S023"]


def test_S023_omission_with_a_reason_passes() -> None:
    assert (
        _omit("""\
@sentry_schema_serializer(omit_from_public_schema={"secret": "internal only"})
class S(serializers.Serializer):
    secret = serializers.CharField()
""")
        == []
    )


def test_S023_blank_reason_rejected() -> None:
    assert _omit("""\
@sentry_schema_serializer(omit_from_public_schema={"secret": "   "})
class S(serializers.Serializer):
    secret = serializers.CharField()
""") == ["1:S023"]


def test_S023_nonexistent_field_reported() -> None:
    assert _omit("""\
@sentry_schema_serializer(omit_from_public_schema={"nope": "a stated reason"})
class S(serializers.Serializer):
    secret = serializers.CharField()
""") == ["1:S023"]


def test_S023_not_a_mapping_reported() -> None:
    assert _omit("""\
@sentry_schema_serializer(omit_from_public_schema=["secret"])
class S(serializers.Serializer):
    secret = serializers.CharField()
""") == ["1:S023"]


def test_S023_field_inherited_from_in_file_base_is_found() -> None:
    assert (
        _omit("""\
class Base(serializers.Serializer):
    inherited = serializers.CharField()


@sentry_schema_serializer(omit_from_public_schema={"inherited": "a stated reason"})
class S(Base):
    pass
""")
        == []
    )


def test_S023_out_of_file_base_skips_existence_check() -> None:
    assert (
        _omit("""\
@sentry_schema_serializer(omit_from_public_schema={"anything": "a stated reason"})
class S(SomeExternalBase):
    pass
""")
        == []
    )


def test_S023_typeddict_response_keys_are_checked() -> None:
    assert _omit("""\
@sentry_schema_serializer(omit_from_public_schema={"nope": "a stated reason"})
class R(TypedDict):
    key: str
""") == ["1:S023"]


def test_S023_meta_fields_all_skips_existence_check() -> None:
    assert (
        _omit("""\
@sentry_schema_serializer(omit_from_public_schema={"whatever": "a stated reason"})
class S(serializers.Serializer):
    class Meta:
        fields = "__all__"
""")
        == []
    )


def test_S023_meta_fields_list_is_enumerated() -> None:
    assert (
        _omit("""\
@sentry_schema_serializer(omit_from_public_schema={"modelfield": "a stated reason"})
class S(serializers.Serializer):
    class Meta:
        fields = ["modelfield"]
""")
        == []
    )


def test_S023_nested_class_does_not_shadow_a_top_level_one() -> None:
    assert (
        _omit("""\
class Base(serializers.Serializer):
    real = serializers.CharField()


class Holder:
    class Base(serializers.Serializer):
        decoy = serializers.CharField()


@sentry_schema_serializer(omit_from_public_schema={"real": "a stated reason"})
class S(Base):
    pass
""")
        == []
    )


def test_S023_exclude_fields_naming_no_field_reports_both() -> None:
    assert _omit("""\
@extend_schema_serializer(exclude_fields=["ghost"])
class S(serializers.Serializer):
    real = serializers.CharField()
""") == ["1:S023", "1:S023"]


def test_S021_typing_union_mismatch_fires() -> None:
    assert _resp("""\
class E:
    @extend_schema(responses={200: inline_sentry_response_serializer("A", AResponse)})
    def get(self) -> Union[Response[BResponse], Response[DetailResponse]]: ...
""") == ["3:S021"]


def test_S021_typing_union_match_passes() -> None:
    assert (
        _resp("""\
class E:
    @extend_schema(responses={200: inline_sentry_response_serializer("A", AResponse)})
    def get(self) -> Union[Response[AResponse], Response[DetailResponse]]: ...
""")
        == []
    )


def test_S021_optional_mismatch_fires() -> None:
    assert _resp("""\
class E:
    @extend_schema(responses={200: inline_sentry_response_serializer("A", AResponse)})
    def get(self) -> Optional[Response[BResponse]]: ...
""") == ["3:S021"]


def test_S021_optional_match_passes() -> None:
    assert (
        _resp("""\
class E:
    @extend_schema(responses={200: inline_sentry_response_serializer("A", AResponse)})
    def get(self) -> Optional[Response[AResponse]]: ...
""")
        == []
    )


def test_S021_none_arm_is_ignored_not_disqualifying() -> None:
    assert _resp("""\
class E:
    @extend_schema(responses={200: inline_sentry_response_serializer("A", AResponse)})
    def get(self) -> Response[BResponse] | None: ...
""") == ["3:S021"]


def test_S021_none_arm_with_matching_type_passes() -> None:
    assert (
        _resp("""\
class E:
    @extend_schema(responses={200: inline_sentry_response_serializer("A", AResponse)})
    def get(self) -> Response[AResponse] | None: ...
""")
        == []
    )


def test_S021_bare_response_inside_typing_union_still_skipped() -> None:
    assert (
        _resp("""\
class E:
    @extend_schema(responses={200: inline_sentry_response_serializer("A", AResponse)})
    def get(self) -> Union[Response, Response[BResponse]]: ...
""")
        == []
    )


def test_S021_non_response_arm_in_typing_union_still_skipped() -> None:
    assert (
        _resp("""\
class E:
    @extend_schema(responses={200: inline_sentry_response_serializer("A", AResponse)})
    def get(self) -> Union[Response[BResponse], StreamingHttpResponse]: ...
""")
        == []
    )


def test_S023_chained_meta_fields_assignment_is_enumerated() -> None:
    assert (
        _omit("""\
@sentry_schema_serializer(omit_from_public_schema={"modelfield": "a stated reason"})
class S(serializers.Serializer):
    class Meta:
        default_fields = fields = ["modelfield"]
""")
        == []
    )


def test_S023_chained_meta_fields_all_skips_existence_check() -> None:
    assert (
        _omit("""\
@sentry_schema_serializer(omit_from_public_schema={"whatever": "a stated reason"})
class S(serializers.Serializer):
    class Meta:
        default_fields = fields = "__all__"
""")
        == []
    )


def test_S023_meta_assignment_without_fields_target_is_ignored() -> None:
    assert _omit("""\
@sentry_schema_serializer(omit_from_public_schema={"nope": "a stated reason"})
class S(serializers.Serializer):
    class Meta:
        model = something
        exclude = ["nope"]
""") == ["1:S023"]


def _run_input(src: str, enforced: frozenset[str] = frozenset({"declared"})) -> list[str]:
    """Run the endpoint input rules with the named rules enforced."""
    import tools.flake8_plugin as plugin

    original = plugin.ENFORCED
    plugin.ENFORCED = enforced
    try:
        return [
            e
            for e in _run(src, filename="src/sentry/api/endpoints/t.py")
            if any(code in e for code in ("S025", "S026", "S027", "S028"))
        ]
    finally:
        plugin.ENFORCED = original


def test_S025_query_serializer_not_declared_is_reported() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    def get(self, request) -> Response[X]:
        QuerySerializer(data=request.GET)
"""
    assert _run_input(src) == [
        "t.py:5:8: S025 QuerySerializer validates the query string but is not declared in "
        "@extend_schema(parameters=...), so the schema does not document what this endpoint "
        "accepts. Add it to parameters=."
    ]


def test_S025_query_serializer_declared_is_silent() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    @extend_schema(parameters=[QuerySerializer])
    def get(self, request) -> Response[X]:
        QuerySerializer(data=request.query_params)
"""
    assert _run_input(src) == []


def test_S025_declared_on_the_class_counts() -> None:
    src = """\
@extend_schema(parameters=[QuerySerializer])
class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    def get(self, request) -> Response[X]:
        QuerySerializer(data=request.GET)
"""
    assert _run_input(src) == []


def test_S025_read_through_a_local_alias_is_seen() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    def get(self, request) -> Response[X]:
        params = request.query_params
        QuerySerializer(data=params)
"""
    assert len(_run_input(src)) == 1


def test_S025_body_serializer_not_declared_is_reported() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"POST": ApiPublishStatus.PUBLIC}

    def post(self, request) -> Response[X]:
        BodySerializer(data=request.data)
"""
    errors = _run_input(src)
    assert len(errors) == 1
    assert "validates the request body" in errors[0]


def test_S025_body_serializer_declared_is_silent() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"POST": ApiPublishStatus.PUBLIC}

    @extend_schema(request=BodySerializer)
    def post(self, request) -> Response[X]:
        BodySerializer(data=request.data)
"""
    assert _run_input(src) == []


def test_S025_declaring_more_than_is_used_is_allowed() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    @extend_schema(parameters=[GlobalParams.ORG_ID_OR_SLUG, CursorQueryParam, QuerySerializer])
    def get(self, request) -> Response[X]:
        QuerySerializer(data=request.GET)
"""
    assert _run_input(src) == []


def test_S025_plain_call_with_data_is_not_a_serializer() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"POST": ApiPublishStatus.PUBLIC}

    def post(self, request) -> Response[X]:
        installation.get_issue(data=request.data)
"""
    assert _run_input(src) == []


def test_S025_runtime_chosen_class_is_skipped() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"PUT": ApiPublishStatus.PUBLIC}

    def put(self, request) -> Response[X]:
        serializer_cls(data=request.data)
"""
    assert _run_input(src) == []


def test_S025_private_method_is_skipped() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PRIVATE}

    def get(self, request) -> Response[X]:
        QuerySerializer(data=request.GET)
"""
    assert _run_input(src) == []


def test_S025_mixed_publish_status_analyzes_only_the_public_method() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC, "POST": ApiPublishStatus.PRIVATE}

    def get(self, request) -> Response[X]:
        AQuerySerializer(data=request.GET)

    def post(self, request) -> Response[X]:
        BBodySerializer(data=request.data)
"""
    errors = _run_input(src)
    assert len(errors) == 1
    assert "AQuerySerializer" in errors[0]


def test_input_rules_record_instead_of_gating_when_unenforced() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    def get(self, request) -> Response[X]:
        QuerySerializer(data=request.GET)
"""
    assert _run_input(src, frozenset()) == []


def test_S025_media_type_mapping_declares_the_body() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"POST": ApiPublishStatus.PUBLIC}

    @extend_schema(request={"multipart/form-data": UploadSerializer})
    def post(self, request) -> Response[X]:
        UploadSerializer(data=request.data)
"""
    assert _run_input(src) == []


def test_S025_body_serializer_declared_as_an_instance_is_silent() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"PUT": ApiPublishStatus.PUBLIC}

    @extend_schema(request=BodySerializer(partial=True))
    def put(self, request) -> Response[X]:
        BodySerializer(data=request.data, partial=True)
"""
    assert _run_input(src) == []


def test_S025_query_serializer_declared_as_an_instance_is_silent() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    @extend_schema(parameters=[QuerySerializer(partial=True)])
    def get(self, request) -> Response[X]:
        QuerySerializer(data=request.GET)
"""
    assert _run_input(src) == []


def test_S025_instance_of_another_serializer_is_still_reported() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"PUT": ApiPublishStatus.PUBLIC}

    @extend_schema(request=OtherSerializer(partial=True))
    def put(self, request) -> Response[X]:
        BodySerializer(data=request.data)
"""
    errors = _run_input(src)
    assert len(errors) == 1
    assert "validates the request body" in errors[0]


SHAPED = frozenset({"shaped"})


def test_S026_raw_query_read_is_reported() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    def get(self, request) -> Response[X]:
        return request.GET.get("truncate")
"""
    errors = _run_input(src, SHAPED)
    assert errors == [
        "t.py:5:15: S026 'truncate' is read straight off the query string instead of "
        "through a serializer declared in @extend_schema, so nothing ties the schema to "
        "what this endpoint accepts. Read it through a declared serializer, or declare "
        "this endpoint's input as an exception."
    ]


def test_S026_raw_body_read_is_reported() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"POST": ApiPublishStatus.PUBLIC}

    def post(self, request) -> Response[X]:
        return request.data["origin"]
"""
    errors = _run_input(src, SHAPED)
    assert len(errors) == 1
    assert "'origin' is read straight off the request body" in errors[0]


def test_S026_subscript_and_getlist_are_both_reads() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    def get(self, request) -> Response[X]:
        a = request.GET["one"]
        b = request.GET.getlist("two")
        return a, b
"""
    assert len(_run_input(src, SHAPED)) == 2


def test_S026_read_through_validated_data_is_accepted() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    @extend_schema(parameters=[QuerySerializer])
    def get(self, request) -> Response[X]:
        serializer = QuerySerializer(data=request.GET)
        return serializer.validated_data["truncate"]
"""
    assert _run_input(src, SHAPED) == []


def test_S026_private_method_is_skipped() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PRIVATE}

    def get(self, request) -> Response[X]:
        return request.GET.get("truncate")
"""
    assert _run_input(src, SHAPED) == []


def test_S027_computed_key_is_reported() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    def get(self, request) -> Response[X]:
        return request.GET.get(some_name)
"""
    errors = _run_input(src, SHAPED)
    assert len(errors) == 1
    assert errors[0].startswith(
        "t.py:5:15: S027 the query string is read with the computed key some_name"
    )


def test_S027_loop_over_literal_keys_is_silent() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    def get(self, request) -> Response[X]:
        for key in ("app_id", "branch"):
            request.GET.get(key)
"""
    assert _run_input(src, SHAPED) == []


def test_S027_loop_over_literal_keys_in_list_comprehension_format_is_silent() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    def get(self, request) -> Response[X]:
        return [request.GET.get(key) for key in ("app_id", "branch")]
"""
    assert _run_input(src, SHAPED) == []


def test_S027_loop_over_literal_keys_in_dict_comprehension_format_is_silent() -> None:
    src = """\
REQUIRED_PARAMS = ["app_id", "branch"]


class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    def get(self, request) -> Response[X]:
        return {key: request.GET.get(key) for key in REQUIRED_PARAMS}
"""
    assert _run_input(src, SHAPED) == []


def test_S027_loop_over_request_in_list_comprehension_format_is_reported() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    def get(self, request) -> Response[X]:
        return [request.GET.get(key) for key in request.GET]
"""
    errors = _run_input(src, SHAPED)
    assert len(errors) == 1
    assert "S027 the query string is read with the computed key key" in errors[0]


def test_S027_list_comprehension_variable_read_after_it_is_still_reported() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    def get(self, request) -> Response[X]:
        values = [request.GET.get(key) for key in ("app_id", "branch")]
        return request.GET.get(key)
"""
    errors = _run_input(src, SHAPED)
    assert len(errors) == 1
    assert "S027 the query string is read with the computed key key" in errors[0]


def test_S027_loop_over_same_file_constant_list_is_silent() -> None:
    src = """\
REQUIRED_PARAMS = ["app_id", "branch"]


class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    def get(self, request) -> Response[X]:
        for param in REQUIRED_PARAMS:
            request.GET.get(param)
"""
    assert _run_input(src, SHAPED) == []


def test_S027_loop_over_annotated_constant_dict_items_is_silent() -> None:
    src = """\
QUERY_PARAMS: dict[str, Any] = {
    "app_id": {"required": True},
    "branch": {"required": False},
}


class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    def get(self, request) -> Response[X]:
        for param, spec in QUERY_PARAMS.items():
            if spec.get("required") and not request.GET.get(param):
                return Response(status=400)
"""
    assert _run_input(src, SHAPED) == []


def test_S027_loop_over_declared_serializer_fields_is_silent() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"PUT": ApiPublishStatus.PUBLIC}

    @extend_schema(request=ProjectAdminSerializer)
    def put(self, request) -> Response[X]:
        for key in ProjectAdminSerializer().fields.keys():
            request.data.get(key)
"""
    assert _run_input(src, SHAPED) == []


def test_S027_loop_over_undeclared_serializer_fields_is_still_reported() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"PUT": ApiPublishStatus.PUBLIC}

    def put(self, request) -> Response[X]:
        for key in ProjectAdminSerializer().fields.keys():
            request.data.get(key)
"""
    errors = _run_input(src, SHAPED)
    assert len(errors) == 1
    assert "S027 the request body is read with the computed key key" in errors[0]


def test_S027_loop_over_imported_constant_is_still_reported() -> None:
    src = """\
from sentry.somewhere import REQUIRED_PARAMS


class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    def get(self, request) -> Response[X]:
        for param in REQUIRED_PARAMS:
            request.GET.get(param)
"""
    errors = _run_input(src, SHAPED)
    assert len(errors) == 1
    assert "S027 the query string is read with the computed key param" in errors[0]


def test_S027_loop_over_request_keys_is_still_reported() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    def get(self, request) -> Response[X]:
        for key in request.GET:
            request.GET.get(key)
"""
    errors = _run_input(src, SHAPED)
    assert len(errors) == 1
    assert "S027 the query string is read with the computed key key" in errors[0]


def test_S027_loop_variable_outside_the_loop_is_still_reported() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    def get(self, request) -> Response[X]:
        for key in ("app_id", "branch"):
            pass
        return request.GET.get(key)
"""
    errors = _run_input(src, SHAPED)
    assert len(errors) == 1
    assert "S027 the query string is read with the computed key key" in errors[0]


def test_S027_inner_loop_reusing_the_name_keeps_the_outer_key_safe() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    def get(self, request) -> Response[X]:
        for key in ("app_id", "branch"):
            for key in ("project", "environment"):
                request.GET.get(key)
            request.GET.get(key)
"""
    assert _run_input(src, SHAPED) == []


def test_S028_hand_off_is_reported() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    def get(self, request) -> Response[X]:
        return installation.get_link_issue_config(params=request.GET)
"""
    errors = _run_input(src, SHAPED)
    assert len(errors) == 1
    assert "handed to get_link_issue_config" in errors[0]


def test_S028_container_operations_are_not_hand_offs() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    def get(self, request) -> Response[X]:
        return len(request.GET), sorted(request.GET)
"""
    assert _run_input(src, SHAPED) == []


def test_S028_building_a_serializer_is_not_a_hand_off() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    @extend_schema(parameters=[QuerySerializer])
    def get(self, request) -> Response[X]:
        return QuerySerializer(data=request.GET)
"""
    assert _run_input(src, SHAPED) == []


def test_S028_runtime_chosen_serializer_class_is_not_a_hand_off() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"PUT": ApiPublishStatus.PUBLIC}

    def put(self, request) -> Response[X]:
        return serializer_cls(data=request.data)
"""
    assert _run_input(src, SHAPED) == []


def test_S028_serializer_class_attribute_is_not_a_hand_off() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"PUT": ApiPublishStatus.PUBLIC}

    def put(self, request) -> Response[X]:
        return self.serializer_cls(data=request.data)
"""
    assert _run_input(src, SHAPED) == []


def test_S028_serializer_reached_through_a_lowercase_attribute_is_not_a_hand_off() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"PUT": ApiPublishStatus.PUBLIC}

    def put(self, request) -> Response[X]:
        settings.validator(instance=x, data=request.data)
        return self.get_serializer(data=request.data)
"""
    assert _run_input(src, SHAPED) == []


def test_S028_plain_call_taking_data_is_still_a_hand_off() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"PUT": ApiPublishStatus.PUBLIC}

    def put(self, request) -> Response[X]:
        return installation.get_issue(external_id, data=request.data)
"""
    errors = _run_input(src, SHAPED)
    assert len(errors) == 1
    assert "handed to get_issue" in errors[0]


def test_S028_class_variable_without_data_is_still_a_hand_off() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"PUT": ApiPublishStatus.PUBLIC}

    def put(self, request) -> Response[X]:
        return serializer_cls(request.data)
"""
    errors = _run_input(src, SHAPED)
    assert len(errors) == 1
    assert "handed to serializer_cls" in errors[0]


def test_shaped_rule_records_instead_of_gating_when_unenforced() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    def get(self, request) -> Response[X]:
        return request.GET.get("truncate")
"""
    assert _run_input(src, frozenset()) == []


def test_rules_are_enabled_independently() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    def get(self, request) -> Response[X]:
        QuerySerializer(data=request.GET)
        return request.GET.get("truncate")
"""
    declared_only = _run_input(src, frozenset({"declared"}))
    assert len(declared_only) == 1 and "S025" in declared_only[0]
    shaped_only = _run_input(src, SHAPED)
    assert len(shaped_only) == 1 and "S026" in shaped_only[0]


def test_S026_serializer_and_response_data_are_not_request_body() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"POST": ApiPublishStatus.PUBLIC}

    def post(self, request) -> Response[X]:
        serializer.data["title"]
        response.data["title"]
        return serializer.data.get("slug")
"""
    assert _run_input(src, SHAPED) == []


def test_S026_request_via_self_is_still_a_read() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    def get(self, request) -> Response[X]:
        return self.request.GET.get("truncate")
"""
    assert len(_run_input(src, SHAPED)) == 1


def test_S026_subscript_write_is_not_a_read() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"POST": ApiPublishStatus.PUBLIC}

    def post(self, request) -> Response[X]:
        request.data["title"] = "default"
        del request.data["scratch"]
        return request.data["title"]
"""
    errors = _run_input(src, SHAPED)
    assert len(errors) == 1
    assert "t.py:7:" in errors[0]


def test_S028_plain_function_taking_data_is_still_a_hand_off() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    def get(self, request) -> Response[X]:
        return my_func(data=request.GET)
"""
    errors = _run_input(src, SHAPED)
    assert len(errors) == 1
    assert "handed to my_func" in errors[0]


def test_S028_method_taking_data_is_still_a_hand_off() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"POST": ApiPublishStatus.PUBLIC}

    def post(self, request) -> Response[X]:
        return installation.build(data=request.data)
"""
    errors = _run_input(src, SHAPED)
    assert len(errors) == 1
    assert "handed to build" in errors[0]


def test_S028_request_data_as_a_lookup_default_is_not_a_hand_off() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    def get(self, request) -> Response[X]:
        return options.get("key", request.GET)
"""
    assert _run_input(src, SHAPED) == []


def test_S028_date_helper_with_documented_params_is_not_a_hand_off() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    @extend_schema(
        parameters=[
            GlobalParams.START,
            GlobalParams.END,
            GlobalParams.STATS_PERIOD,
            GlobalParams.STATS_PERIOD_START,
            GlobalParams.STATS_PERIOD_END,
        ]
    )
    def get(self, request) -> Response[X]:
        return get_date_range_from_params(request.GET)
"""
    assert _run_input(src, SHAPED) == []


def test_S028_date_helper_without_documented_params_is_still_a_hand_off() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    def get(self, request) -> Response[X]:
        return get_date_range_from_params(request.GET)
"""
    errors = _run_input(src, SHAPED)
    assert len(errors) == 1
    assert "handed to get_date_range_from_params" in errors[0]


def test_S028_date_helper_with_some_documented_params_is_still_a_hand_off() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    @extend_schema(parameters=[GlobalParams.START, GlobalParams.END, GlobalParams.STATS_PERIOD])
    def get(self, request) -> Response[X]:
        return get_date_range_from_params(request.GET)
"""
    errors = _run_input(src, SHAPED)
    assert len(errors) == 1
    assert "handed to get_date_range_from_params" in errors[0]


def test_S028_stats_period_date_helper_with_documented_params_is_not_a_hand_off() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    @extend_schema(
        parameters=[
            GlobalParams.START,
            GlobalParams.END,
            GlobalParams.STATS_PERIOD,
            GlobalParams.STATS_PERIOD_START,
            GlobalParams.STATS_PERIOD_END,
        ]
    )
    def get(self, request) -> Response[X]:
        return get_date_range_from_stats_period(request.GET)
"""
    assert _run_input(src, SHAPED) == []


def _api_violations(
    src: str, enforced: frozenset[str] = frozenset(), all_rules: bool = True
) -> list[ApiInputViolation]:
    """Structured S025-S028 violations, with the named rule groups enforced."""
    tree = ast.parse(src)
    with patch("tools.flake8_plugin.ENFORCED", enforced):
        return get_api_violations(tree, "src/sentry/api/endpoints/t.py", all_rules)


def test_api_violations_report_every_field() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    def get(self, request) -> Response[X]:
        return request.GET.get("truncate")
"""
    assert _api_violations(src) == [
        ApiInputViolation(
            rule=ApiRule.S026,
            message=S026_msg.format(repr("truncate"), "query string"),
            line=5,
            column=15,
            end_line=5,
            end_column=42,
            severity="warning",
            scope="E.get",
            key="query:truncate",
        )
    ]


def test_api_violations_scope_and_key_for_each_rule() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC, "POST": ApiPublishStatus.PUBLIC}

    def get(self, request) -> Response[X]:
        QuerySerializer(data=request.GET)
        return request.GET.get(some_name)

    def post(self, request) -> Response[X]:
        BodySerializer(data=request.data)
        return helper(request.data)
"""
    violations = _api_violations(src)
    assert len(violations) == 4

    assert violations[0].rule == "S025"
    assert violations[0].scope == "E.get"
    assert violations[0].key == "query:QuerySerializer"

    assert violations[1].rule == "S027"
    assert violations[1].scope == "E.get"
    assert violations[1].key == "query:some_name"

    assert violations[2].rule == "S025"
    assert violations[2].scope == "E.post"
    assert violations[2].key == "body:BodySerializer"

    assert violations[3].rule == "S028"
    assert violations[3].scope == "E.post"
    assert violations[3].key == "body:helper"


def test_api_violations_rule_is_an_api_rule() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC, "POST": ApiPublishStatus.PUBLIC}

    def get(self, request) -> Response[X]:
        QuerySerializer(data=request.GET)
        request.GET.get("truncate")
        return request.GET.get(some_name)

    def post(self, request) -> Response[X]:
        BodySerializer(data=request.data)
        return helper(request.data)
"""
    violations = _api_violations(src)
    assert len(violations) == 5
    for violation in violations:
        assert isinstance(violation.rule, ApiRule)
        assert violation.message.startswith(f"{violation.rule} ")

    rules = set()
    for violation in violations:
        rules.add(violation.rule)
    assert rules == {ApiRule.S025, ApiRule.S026, ApiRule.S027, ApiRule.S028}


def test_api_rule_messages_start_with_their_code() -> None:
    assert S021_msg.startswith(f"{ApiRule.S021} ")
    assert S022_missing_msg.startswith(f"{ApiRule.S022} ")
    assert S022_bare_msg.startswith(f"{ApiRule.S022} ")
    assert S023_no_reason_msg.startswith(f"{ApiRule.S023} ")
    assert S023_not_mapping_msg.startswith(f"{ApiRule.S023} ")
    assert S023_blank_reason_msg.startswith(f"{ApiRule.S023} ")
    assert S023_ghost_msg.startswith(f"{ApiRule.S023} ")
    assert S023_bad_path_msg.startswith(f"{ApiRule.S023} ")
    assert S025_query_msg.startswith(f"{ApiRule.S025} ")
    assert S025_body_msg.startswith(f"{ApiRule.S025} ")
    assert S026_msg.startswith(f"{ApiRule.S026} ")
    assert S027_msg.startswith(f"{ApiRule.S027} ")
    assert S028_msg.startswith(f"{ApiRule.S028} ")


def test_api_violations_keep_query_and_body_reads_apart() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"POST": ApiPublishStatus.PUBLIC}

    def post(self, request) -> Response[X]:
        return request.GET.get("id"), request.data["id"]
"""
    violations = _api_violations(src)
    assert len(violations) == 2
    assert violations[0].key == "query:id"
    assert violations[1].key == "body:id"


def test_api_violations_span_multiple_lines() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    def get(self, request) -> Response[X]:
        return helper(
            request.GET,
        )
"""
    violations = _api_violations(src)
    assert len(violations) == 1
    assert violations[0].line == 5
    assert violations[0].end_line == 7


def test_api_violations_are_reported_when_flake_is_silent() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    def get(self, request) -> Response[X]:
        return request.GET.get("truncate")
"""
    assert _run_input(src, frozenset()) == []
    assert len(_api_violations(src)) == 1


def test_lint_all_prints_unenforced_rules_without_enforcing_them() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    def get(self, request) -> Response[X]:
        return request.GET.get("truncate")
"""
    with patch.dict(os.environ, {"SENTRY_INPUT_LINT_ALL": "1"}):
        errors = _run_input(src, frozenset())
        violations = _api_violations(src)

    assert len(errors) == 1
    assert errors[0] == "t.py:5:15: " + S026_msg.format(repr("truncate"), "query string")
    assert len(violations) == 1
    assert violations[0].severity == "warning"


def test_api_violations_severity_follows_enforcement() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    def get(self, request) -> Response[X]:
        QuerySerializer(data=request.GET)
        return request.GET.get("truncate")
"""
    violations = _api_violations(src, enforced=SHAPED)
    assert len(violations) == 2
    assert violations[0].rule == "S025"
    assert violations[0].severity == "warning"
    assert violations[1].rule == "S026"
    assert violations[1].severity == "error"

    enforced_only = _api_violations(src, enforced=SHAPED, all_rules=False)
    assert len(enforced_only) == 1
    assert enforced_only[0].rule == "S026"


def test_super_call_is_recorded_once() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    def get(self, request) -> Response[X]:
        return super().get(request)
"""
    visitor = SentryVisitor("src/sentry/api/endpoints/t.py", 2000, _s015_msg())
    visitor.visit(ast.parse(src))
    calls = visitor._functions["E.get"].calls
    assert len(calls) == 1
    assert calls[0].kind == "super"
    assert calls[0].name == "get"


def test_method_defined_twice_reports_both_definitions() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    if FLAG:
        def get(self, request) -> Response[X]:
            return Response({"a": request.GET.get("a")})
    else:
        def get(self, request) -> Response[X]:
            return Response({"b": request.GET.get("b")})
"""
    reported = []
    for violation in _api_violations(src):
        reported.append((violation.line, violation.scope, violation.key))
    assert reported == [(6, "E.get", "query:a"), (9, "E.get", "query:b")]


def test_overload_stub_and_real_def_are_both_reported() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    @overload
    def get(self, request) -> Response[X]:
        return Response({"a": request.GET.get("a")})

    def get(self, request) -> Response[X]:
        return Response({"b": request.GET.get("b")})
"""
    reported = []
    for violation in _api_violations(src):
        reported.append((violation.line, violation.key))
    assert reported == [(6, "query:a"), (9, "query:b")]


def test_api_violations_skip_private_methods() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PRIVATE}

    def get(self, request) -> Response[X]:
        return request.GET.get("truncate")
"""
    assert _api_violations(src) == []


def _summary(violations: list[ApiInputViolation]) -> list[tuple[ApiRule, int, str, str]]:
    """(rule, line, scope, key) for each violation, in report order."""
    summary = []
    for violation in violations:
        summary.append((violation.rule, violation.line, violation.scope, violation.key))
    return summary


def test_helper_method_read_is_reported_at_the_helper() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    def get(self, request) -> Response[X]:
        return self._status(request)

    def _status(self, request):
        return request.GET.get("status")
"""
    assert _summary(_api_violations(src)) == [("S026", 8, "E._status", "query:status")]


def test_helper_defined_below_and_module_function_are_followed() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    def get(self, request) -> Response[X]:
        self._one(request)
        return build(request)

    def _one(self, request):
        return request.GET.get("one")


def build(request):
    return request.GET.get("two")
"""
    assert _summary(_api_violations(src)) == [
        ("S026", 9, "E._one", "query:one"),
        ("S026", 13, "build", "query:two"),
    ]


def test_helpers_of_helpers_are_followed() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    def get(self, request) -> Response[X]:
        return self._outer(request)

    def _outer(self, request):
        return self._inner(request)

    def _inner(self, request):
        return request.GET.get("deep")
"""
    assert _summary(_api_violations(src)) == [("S026", 11, "E._inner", "query:deep")]


def test_helper_serializer_is_checked_against_the_public_method_schema() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    def get(self, request) -> Response[X]:
        return self._validate(request)

    def _validate(self, request):
        return QuerySerializer(data=request.GET)
"""
    assert _summary(_api_violations(src)) == [("S025", 8, "E.get", "query:QuerySerializer")]


def test_helper_serializer_declared_on_the_public_method_is_silent() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    @extend_schema(parameters=[QuerySerializer])
    def get(self, request) -> Response[X]:
        return self._validate(request)

    def _validate(self, request):
        return QuerySerializer(data=request.GET)
"""
    assert _api_violations(src) == []


def test_subclass_override_wins_over_the_base_method() -> None:
    src = """\
class Base(Endpoint):
    def _limit(self, request):
        return request.GET.get("base_limit")


class E(Base):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    def get(self, request) -> Response[X]:
        return self._limit(request)

    def _limit(self, request):
        return request.GET.get("limit")
"""
    assert _summary(_api_violations(src)) == [("S026", 13, "E._limit", "query:limit")]


def test_inherited_helper_resolves_from_the_public_class() -> None:
    src = """\
class Base(Endpoint):
    def _shared(self, request):
        return self._limit(request)

    def _limit(self, request):
        return request.GET.get("base_limit")


class E(Base):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    def get(self, request) -> Response[X]:
        return self._shared(request)

    def _limit(self, request):
        return request.GET.get("limit")
"""
    assert _summary(_api_violations(src)) == [("S026", 16, "E._limit", "query:limit")]


def test_super_call_skips_the_defining_class() -> None:
    src = """\
class Base(Endpoint):
    def _filters(self, request):
        return request.GET.get("base")


class E(Base):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    def get(self, request) -> Response[X]:
        return self._filters(request)

    def _filters(self, request):
        super()._filters(request)
        return request.GET.get("child")
"""
    assert _summary(_api_violations(src)) == [
        ("S026", 14, "E._filters", "query:child"),
        ("S026", 3, "Base._filters", "query:base"),
    ]


def test_method_from_a_base_in_another_file_is_not_followed() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    def get(self, request) -> Response[X]:
        self.get_filters(request)
        return self.paginate(request.GET)
"""
    assert _summary(_api_violations(src)) == [("S028", 6, "E.get", "query:paginate")]


def test_hand_off_to_a_followed_helper_is_dropped_but_other_hand_offs_stay() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    def get(self, request) -> Response[X]:
        self._use(request.GET)
        return parse_filters(request.GET)

    def _use(self, params):
        return None
"""
    assert _summary(_api_violations(src)) == [("S028", 6, "E.get", "query:parse_filters")]


def test_starred_call_to_a_helper_keeps_its_hand_off() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    def get(self, request, *args) -> Response[X]:
        return self._use(request.GET, *args)

    def _use(self, params, *args):
        return None
"""
    assert _summary(_api_violations(src)) == [("S028", 5, "E.get", "query:_use")]


def test_helper_shared_by_two_public_methods_is_reported_once() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC, "POST": ApiPublishStatus.PUBLIC}

    def get(self, request) -> Response[X]:
        return self._shared(request)

    def post(self, request) -> Response[X]:
        return self._shared(request)

    def _shared(self, request):
        return request.GET.get("k")
"""
    violations = _api_violations(src)
    assert _summary(violations) == [("S026", 11, "E._shared", "query:k")]
    # the first public method in the file that reaches it
    assert violations[0].caller == "E.get"


def test_helper_read_records_its_caller_and_a_direct_read_does_not() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    def get(self, request) -> Response[X]:
        request.GET.get("direct")
        return build(request)


def build(request):
    return request.GET.get("inside")
"""
    violations = _api_violations(src)
    assert _summary(violations) == [
        ("S026", 5, "E.get", "query:direct"),
        ("S026", 10, "build", "query:inside"),
    ]
    assert violations[0].caller is None
    # a module-level helper has no class, so its owner comes from the method that reaches it
    assert violations[1].caller == "E.get"


def test_helper_reached_from_three_methods_is_one_finding() -> None:
    src = """\
class E(Endpoint):
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
        "PUT": ApiPublishStatus.PUBLIC,
        "DELETE": ApiPublishStatus.PUBLIC,
    }

    def get(self, request) -> Response[X]:
        return self.filter_things(request)

    def put(self, request) -> Response[X]:
        return self.filter_things(request)

    def delete(self, request) -> Response[X]:
        return self.filter_things(request)

    def filter_things(self, request):
        return request.GET.getlist("id")
"""
    assert _summary(_api_violations(src)) == [("S026", 18, "E.filter_things", "query:id")]


def test_helper_serializer_stays_on_each_calling_method() -> None:
    # S025 depends on the calling method's @extend_schema, so it isn't merged across callers
    src = """\
class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC, "PUT": ApiPublishStatus.PUBLIC}

    def get(self, request) -> Response[X]:
        return self._validate(request)

    @extend_schema(parameters=[QuerySerializer])
    def put(self, request) -> Response[X]:
        return self._validate(request)

    def _validate(self, request):
        return QuerySerializer(data=request.GET)
"""
    assert _summary(_api_violations(src)) == [("S025", 12, "E.get", "query:QuerySerializer")]


def test_helper_with_no_public_caller_is_not_reported() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    def get(self, request) -> Response[X]:
        return Response()

    def _unused(self, request):
        return request.GET.get("k")
"""
    assert _api_violations(src) == []


def test_calls_in_decorators_are_not_followed() -> None:
    src = """\
def configure(request):
    return request.GET.get("k")


class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    @some_decorator(configure(request))
    def get(self, request) -> Response[X]:
        return Response()
"""
    assert _api_violations(src) == []


def test_payload_bound_to_a_renamed_parameter_is_read() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    def get(self, request) -> Response[X]:
        return self._read(request.GET)

    def _read(self, params):
        return params.get("y")
"""
    assert _summary(_api_violations(src)) == [("S026", 8, "E._read", "query:y")]


def test_request_bound_to_a_renamed_parameter_is_read() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"POST": ApiPublishStatus.PUBLIC}

    def post(self, request) -> Response[X]:
        return self._read(request)

    def _read(self, req):
        return req.data.get("z")
"""
    assert _summary(_api_violations(src)) == [("S026", 8, "E._read", "body:z")]


def test_same_helper_reads_whatever_each_caller_passes() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC, "POST": ApiPublishStatus.PUBLIC}

    def get(self, request) -> Response[X]:
        return self._read(request.GET)

    def post(self, request) -> Response[X]:
        return self._read(request.data)

    def _read(self, params):
        return params.get("k")
"""
    assert _summary(_api_violations(src)) == [
        ("S026", 11, "E._read", "query:k"),
        ("S026", 11, "E._read", "body:k"),
    ]


def test_whole_request_is_bound_through_two_levels() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    def get(self, request) -> Response[X]:
        return self._outer(request)

    def _outer(self, req):
        return self._inner(req)

    def _inner(self, r):
        return r.GET.get("z")
"""
    assert _summary(_api_violations(src)) == [("S026", 11, "E._inner", "query:z")]


def test_payload_passed_by_keyword_is_bound() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    def get(self, request) -> Response[X]:
        return self._read(params=request.GET)

    def _read(self, params):
        return params.get("y")
"""
    assert _summary(_api_violations(src)) == [("S026", 8, "E._read", "query:y")]


def test_staticmethod_helper_has_no_self_to_skip() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    def get(self, request) -> Response[X]:
        return self._read(request.GET)

    @staticmethod
    def _read(params):
        return params.get("y")
"""
    assert _summary(_api_violations(src)) == [("S026", 9, "E._read", "query:y")]


def test_alias_of_a_parameter_is_read() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    def get(self, request) -> Response[X]:
        self._params(request.GET)
        return self._request(request)

    def _params(self, params):
        q = params
        return q.get("a")

    def _request(self, req):
        r = req
        return r.GET.get("b")
"""
    assert _summary(_api_violations(src)) == [
        ("S026", 10, "E._params", "query:a"),
        ("S026", 14, "E._request", "query:b"),
    ]


def test_parameter_that_is_not_request_input_is_not_reported() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    def get(self, request, organization) -> Response[X]:
        return self._read(organization)

    def _read(self, org):
        return org.get("slug")
"""
    assert _api_violations(src) == []


def test_helper_forwarding_its_parameter_to_unknown_code_is_s028() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"POST": ApiPublishStatus.PUBLIC}

    def post(self, request) -> Response[X]:
        return self._use(request.data)

    def _use(self, params):
        return parse_filters(params)
"""
    assert _summary(_api_violations(src)) == [("S028", 8, "E._use", "body:parse_filters")]


def test_public_method_passing_a_non_request_parameter_keeps_its_s028() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    def get(self, request, organization) -> Response[X]:
        return serialize(organization, request.GET)
"""
    assert _summary(_api_violations(src)) == [("S028", 5, "E.get", "query:serialize")]


def test_serializer_built_from_a_helper_parameter_is_checked() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"POST": ApiPublishStatus.PUBLIC}

    def post(self, request) -> Response[X]:
        return self._validate(request.data)

    def _validate(self, params):
        return BodySerializer(data=params)
"""
    assert _summary(_api_violations(src)) == [("S025", 8, "E.post", "body:BodySerializer")]


def test_payload_that_cannot_be_bound_keeps_its_s028() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    def get(self, request) -> Response[X]:
        self._extra(None, request.GET)
        self._unknown(nope=request.GET)
        return self._varargs(request.GET)

    def _extra(self, first):
        return None

    def _unknown(self, params):
        return None

    def _varargs(self, *args):
        return None
"""
    assert _summary(_api_violations(src)) == [
        ("S028", 5, "E.get", "query:_extra"),
        ("S028", 6, "E.get", "query:_unknown"),
        ("S028", 7, "E.get", "query:_varargs"),
    ]


def _helper_body_summary(body: str) -> list[tuple[ApiRule, int, str, str]]:
    """The findings for a GET that passes the query string to `self._h(q)`, with `body` as _h's body"""
    src = (
        """\
class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    def get(self, request) -> Response[X]:
        return self._h(request.GET)

    def _h(self, q):
"""
        + body
    )
    return _summary(_api_violations(src))


def test_helper_that_lets_the_payload_leave_keeps_the_s028() -> None:
    leaking_bodies = [
        "        return q\n",
        "        return q.copy()\n",
        "        return q or {}\n",
        "        return x if c else q\n",
        "        yield q\n",
        "        self.q = q\n",
        '        d = {}\n        d["k"] = q\n        return d\n',
        '        return {"k": q}\n',
        "        return [q]\n",
        "        lst = []\n        lst.append(q)\n        return lst\n",
        "        return list(q)\n",
        "        for k in q:\n            print(k)\n",
        "        q2 = q\n        return q2\n",
        '        return options.get("k", q)\n',
    ]
    for body in leaking_bodies:
        assert _helper_body_summary(body) == [("S028", 5, "E.get", "query:_h")], body


def test_helper_that_only_reads_or_checks_the_payload_is_followed() -> None:
    assert _helper_body_summary('        return q.get("x")\n') == [("S026", 8, "E._h", "query:x")]
    # isinstance, `in`, `is None`, truthiness and len only look at it
    checks = (
        "        if not isinstance(q, dict) or q is None or not q or len(q) > 3:\n"
        "            return None\n"
        '        if "x" in q and q:\n'
        '            return q["x"]\n'
    )
    assert _helper_body_summary(checks) == [("S026", 11, "E._h", "query:x")]
    # an alias is checked the same way
    assert _helper_body_summary('        q2 = q.copy()\n        return q2.get("x")\n') == [
        ("S026", 9, "E._h", "query:x")
    ]


def test_helper_that_passes_the_payload_to_a_leaking_helper_keeps_that_s028() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    def get(self, request) -> Response[X]:
        return self._outer(request.GET)

    def _outer(self, q):
        return self._inner(q)

    def _inner(self, q):
        return q
"""
    # _outer only forwards q, so the GET's call is followed; _inner lets it leave, so _outer's call keeps it
    assert _summary(_api_violations(src)) == [("S028", 8, "E._outer", "query:_inner")]


def test_helpers_passing_the_payload_back_and_forth_are_followed() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    def get(self, request) -> Response[X]:
        return self._a(request.GET)

    def _a(self, q):
        if q.get("again"):
            return self._b(q)
        return None

    def _b(self, q):
        return self._a(q)
"""
    assert _summary(_api_violations(src)) == [("S026", 8, "E._a", "query:again")]


# Note: when a call could mean more than one function, the helper isn't followed and the call keeps its S028,
# so following helpers never reports LESS than reading each method on its own


def test_call_to_a_nested_def_with_a_helpers_name_keeps_the_s028() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    def get(self, request) -> Response[X]:
        def helper(p):
            return send(p)

        return helper(request.GET)


def helper(q):
    return None
"""
    assert _summary(_api_violations(src)) == [("S028", 8, "E.get", "query:helper")]


def test_call_to_a_local_import_with_a_helpers_name_keeps_the_s028() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    def get(self, request) -> Response[X]:
        from elsewhere import helper

        return helper(request.GET)


def helper(q):
    return q.get("x")
"""
    assert _summary(_api_violations(src)) == [("S028", 7, "E.get", "query:helper")]


def test_call_to_a_parameter_with_a_helpers_name_keeps_the_s028() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    def get(self, request, helper=None) -> Response[X]:
        return helper(request.GET)


def helper(q):
    return q.get("x")
"""
    assert _summary(_api_violations(src)) == [("S028", 5, "E.get", "query:helper")]


def test_shadowed_name_is_checked_in_the_helper_making_the_call() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    def get(self, request) -> Response[X]:
        return self._h(request.GET)

    def _h(self, q):
        from elsewhere import helper

        return helper(q)


def helper(q):
    return q.get("x")
"""
    assert _summary(_api_violations(src)) == [("S028", 10, "E._h", "query:helper")]


def test_helper_defined_twice_keeps_the_s028() -> None:
    src = """\
if FLAG:
    def helper(q):
        return send(q)
else:
    def helper(q):
        return None


class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    def get(self, request) -> Response[X]:
        return helper(request.GET)
"""
    assert _summary(_api_violations(src)) == [("S028", 13, "E.get", "query:helper")]


def test_helper_rebound_at_module_level_keeps_the_s028() -> None:
    src = """\
def helper(q):
    return None


helper = make_sender()


class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    def get(self, request) -> Response[X]:
        return helper(request.GET)
"""
    assert _summary(_api_violations(src)) == [("S028", 12, "E.get", "query:helper")]


def test_method_rebound_in_the_class_body_keeps_the_s028() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    def get(self, request) -> Response[X]:
        return self.h(request.GET)

    def h(self, q):
        return None

    h = external_h
"""
    assert _summary(_api_violations(src)) == [("S028", 5, "E.get", "query:h")]


def test_diamond_class_tree_keeps_the_s028() -> None:
    # Python's order is E, B, C, A, so C.h runs; a depth-first walk would pick A.h
    src = """\
class A:
    def h(self, q):
        return None


class B(A):
    pass


class C(A):
    def h(self, q):
        return send(q)


class E(B, C):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    def get(self, request) -> Response[X]:
        return self.h(request.GET)
"""
    assert _summary(_api_violations(src)) == [("S028", 19, "E.get", "query:h")]


def test_diamond_higher_up_the_class_tree_keeps_the_s028() -> None:
    src = """\
class A:
    def h(self, q):
        return None


class B(A):
    pass


class C(A):
    def h(self, q):
        return send(q)


class D(B, C):
    pass


class E(D):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    def get(self, request) -> Response[X]:
        return self.h(request.GET)
"""
    assert _summary(_api_violations(src)) == [("S028", 23, "E.get", "query:h")]


def test_helper_that_reassigns_its_parameter_keeps_the_s028() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    def get(self, request) -> Response[X]:
        return self._h(request.GET)

    def _h(self, q):
        q = {"a": 1}
        return q.get("a")
"""
    # q no longer holds the query string after it's reassigned, so q.get("a") isn't an S026
    assert _summary(_api_violations(src)) == [("S028", 5, "E.get", "query:_h")]


def _post_body_summary(body: str) -> list[tuple[ApiRule, int, str, str]]:
    """The findings for a public POST whose body is `body`"""
    src = (
        """\
class E(Endpoint):
    publish_status = {"POST": ApiPublishStatus.PUBLIC}

    def post(self, request) -> Response[X]:
"""
        + body
    )
    return _summary(_api_violations(src))


def test_reads_after_a_local_is_reassigned_are_not_s026() -> None:
    body = """\
        data = request.data
        serializer = S(data=data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        return Response(data.get("name"))
"""
    assert _post_body_summary(body) == [("S025", 6, "E.post", "body:S")]


def test_reads_before_a_reassignment_are_still_s026() -> None:
    body = """\
        data = request.data
        first = data.get("a")
        data = {}
        return Response(data.get("b"))
"""
    assert _post_body_summary(body) == [("S026", 6, "E.post", "body:a")]


def test_a_value_built_from_request_input_stays_request_input() -> None:
    # data["inner"] and clean(data) may still be client input, as master treats them
    nested = """\
        data = request.data
        data = data["inner"]
        return Response(data.get("x"))
"""
    assert _post_body_summary(nested) == [
        ("S026", 6, "E.post", "body:inner"),
        ("S026", 7, "E.post", "body:x"),
    ]
    cleaned = """\
        data = request.data
        data = clean(data)
        return Response(data.get("x"))
"""
    assert _post_body_summary(cleaned) == [
        ("S026", 7, "E.post", "body:x"),
        ("S028", 6, "E.post", "body:clean"),
    ]


def test_reassigned_helper_parameter_alias_and_tuple_are_not_s026() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    def get(self, request) -> Response[X]:
        return self._h(request.GET)

    def _h(self, q):
        q2 = q
        q2 = {}
        first, q = load()
        return q.get("a"), q2.get("b")
"""
    assert _summary(_api_violations(src)) == [("S028", 5, "E.get", "query:_h")]


def test_every_way_of_rebinding_a_local_stops_it_being_request_input() -> None:
    rebinds = [
        "        x, data = f()\n        return data.get('x')\n",
        "        for data in items:\n            data.get('x')\n",
        "        with open(p) as data:\n            data.get('x')\n",
        "        try:\n            pass\n        except E as data:\n            data.get('x')\n",
        "        data: dict = {}\n        return data.get('x')\n",
    ]
    for rebind in rebinds:
        assert _post_body_summary("        data = request.data\n" + rebind) == [], rebind


def test_rebinding_to_another_source_changes_the_source() -> None:
    body = """\
        data = request.GET
        data = request.data
        return Response(data.get("x"))
"""
    assert _post_body_summary(body) == [("S026", 7, "E.post", "body:x")]


def test_reassignment_inside_a_block_only_applies_inside_it() -> None:
    # in the block, data is the validated data
    in_block = """\
        data = request.data
        if serializer.is_valid():
            data = serializer.validated_data
            return Response(data.get("x"))
"""
    assert _post_body_summary(in_block) == []
    # after the block it may still be the raw body (when the branch didn't run)
    after_block = """\
        data = request.data
        if c:
            data = serializer.validated_data
        return Response(data.get("x"))
"""
    assert _post_body_summary(after_block) == [("S026", 8, "E.post", "body:x")]
    # the same after a try, and at the top of a loop that reassigns at its end
    after_try = """\
        data = request.data
        try:
            data = parse()
        except ValueError:
            pass
        return Response(data.get("x"))
"""
    assert _post_body_summary(after_try) == [("S026", 10, "E.post", "body:x")]
    loop_end = """\
        data = request.data
        for row in rows:
            data.get("x")
            data = row
"""
    assert _post_body_summary(loop_end) == [("S026", 7, "E.post", "body:x")]
    # a nested def's `data = {}` is its own variable
    nested_def = """\
        data = request.data

        def build():
            data = {}
            return data

        return Response(data.get("x"))
"""
    assert _post_body_summary(nested_def) == [("S026", 11, "E.post", "body:x")]
    # a source set inside a block is still a source after it
    set_in_block = """\
        data = {}
        if c:
            data = request.data
        return Response(data.get("x"))
"""
    assert _post_body_summary(set_in_block) == [("S026", 8, "E.post", "body:x")]


def test_helper_mixing_a_real_source_and_a_parameter_keeps_both_s028s() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    def get(self, request) -> Response[X]:
        return self._a(request.data)

    def _a(self, params):
        return serialize(params, request.GET)
"""
    assert _summary(_api_violations(src)) == [
        ("S028", 8, "E._a", "body:serialize"),
        ("S028", 8, "E._a", "query:serialize"),
    ]


def test_helper_with_two_parameters_forwards_the_payload_one() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    def get(self, request, organization) -> Response[X]:
        return self._a(organization, request.GET)

    def _a(self, org, params):
        return serialize(org, params)
"""
    assert _summary(_api_violations(src)) == [("S028", 8, "E._a", "query:serialize")]


def test_helper_loop_over_a_declared_serializers_fields_is_silent() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    @extend_schema(parameters=[MySerializer])
    def get(self, request) -> Response[X]:
        return self._a(request)

    def _a(self, request):
        for f in MySerializer().fields:
            request.GET.get(f)
        return [request.GET.get(name) for name in MySerializer().fields]
"""
    assert _api_violations(src) == []


def test_helper_loop_over_an_undeclared_serializers_fields_is_s027() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    def get(self, request) -> Response[X]:
        return self._a(request)

    def _a(self, request):
        for f in MySerializer().fields:
            request.GET.get(f)
"""
    assert _summary(_api_violations(src)) == [("S027", 9, "E._a", "query:f")]


def test_isinstance_check_on_a_payload_is_not_a_hand_off() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"POST": ApiPublishStatus.PUBLIC}

    def post(self, request) -> Response[X]:
        return self._record(request.data)

    def _record(self, request_data):
        if not isinstance(request_data, dict):
            return None
        return None
"""
    assert _api_violations(src) == []


def test_conditional_copy_of_the_query_string_is_an_alias() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    def get(self, request) -> Response[X]:
        params = request.GET.copy() if request.GET else {}
        return params.get("k")
"""
    assert _summary(_api_violations(src)) == [("S026", 6, "E.get", "query:k")]


def test_date_range_helper_called_inside_a_helper_uses_the_public_schema() -> None:
    src = """\
class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    @extend_schema(
        parameters=[
            GlobalParams.START,
            GlobalParams.END,
            GlobalParams.STATS_PERIOD,
            GlobalParams.STATS_PERIOD_START,
            GlobalParams.STATS_PERIOD_END,
        ]
    )
    def get(self, request) -> Response[X]:
        return self._range(request)

    def _range(self, req):
        return get_date_range_from_params(req.GET)
"""
    assert _api_violations(src) == []


def test_known_limit_nested_def_reusing_a_parameter_name_reads_the_outer_parameter() -> None:
    # A nested def gets no ctx of its own, so its reads count as the helper's. Here inner's
    # `params` is the empty dict it's passed, but the read is still bound to _a's `params`,
    # which holds the query string. Pinned so it isn't mistaken for a bug.
    src = """\
class E(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    def get(self, request) -> Response[X]:
        return self._a(request.GET)

    def _a(self, params):
        def inner(params):
            return params.get("x")

        return inner({})
"""
    assert _summary(_api_violations(src)) == [("S026", 9, "E._a", "query:x")]


def _run_s023(src: str) -> list[str]:
    return [e for e in _run(src, filename="src/sentry/apidocs/t.py") if "S023" in e]


def test_S023_a_deep_path_checks_only_its_first_segment() -> None:
    src = """\
@sentry_schema_serializer(
    omit_from_public_schema={"data_source.discover": "Deprecated; use events."}
)
class S(serializers.Serializer):
    data_source = serializers.ChoiceField(choices=("discover", "events"))
"""
    assert _run_s023(src) == []


def test_S023_a_deep_path_on_an_unknown_field_is_still_a_ghost() -> None:
    src = """\
@sentry_schema_serializer(omit_from_public_schema={"nope.discover": "why"})
class S(serializers.Serializer):
    data_source = serializers.ChoiceField(choices=("discover",))
"""
    errors = _run_s023(src)
    assert len(errors) == 1
    assert "'nope'" in errors[0]


def test_S023_a_malformed_path_is_reported() -> None:
    src = """\
@sentry_schema_serializer(omit_from_public_schema={"a..b": "why"})
class S(serializers.Serializer):
    a = serializers.CharField()
"""
    errors = _run_s023(src)
    assert len(errors) == 1
    assert "not a usable path" in errors[0]


def test_S023_deprecate_needs_a_reason_too() -> None:
    src = """\
@sentry_schema_serializer(deprecate={"name": "   "})
class S(serializers.Serializer):
    name = serializers.CharField()
"""
    errors = _run_s023(src)
    assert len(errors) == 1
    assert "needs a reason" in errors[0]


def test_S023_deprecate_reports_a_ghost() -> None:
    src = """\
@sentry_schema_serializer(deprecate={"gone": "Use slug."})
class S(serializers.Serializer):
    name = serializers.CharField()
"""
    errors = _run_s023(src)
    assert len(errors) == 1
    assert "deprecate='gone'" in errors[0]


def test_S032() -> None:
    src = """\
def get(self, request):
    Bookmark.objects.filter(user_id=acting_user_id(request.user))  # bad
    Bookmark.objects.get_or_create(user_id=acting_user_id(self.request.user))  # bad
    Bookmark.objects.create(created_by_id=acting_user_id(request.user))  # ok: records no user
    Bookmark.objects.filter(user_id=request.user.id)  # ok: raises for no user
    organization_service.get(user_id=acting_user_id(request.user))  # ok: not a queryset
    Bookmark.objects.filter(project=p).exclude(user_id=acting_user_id(request.user))  # bad
    user_id = acting_user_id(request.user)  # ok
"""
    msg = (
        "S032 acting_user_id() is None when no user is calling (e.g. a service account), "
        "and a None lookup matches rows with no user; call require_user(request) or handle "
        "None first"
    )
    assert _run(src, filename="src/sentry/example.py") == [
        f"t.py:2:28: {msg}",
        f"t.py:3:35: {msg}",
        f"t.py:7:47: {msg}",
    ]


def test_S033() -> None:
    src = """\
def get(self, request, drf_request):
    request.user = user  # bad
    self.request.auth: Any = auth  # bad
    drf_request.user += 1  # bad
    request.user, request.auth = user, auth  # bad x2
    setattr(request, "user", user)  # bad
    setattr(self.request, "auth", auth)  # bad
    request.user_from_viewer_context = True  # ok: other attribute
    setattr(request, "is_sudo", lambda: False)  # ok: other attribute
    user.auth = auth  # ok: not a request
    set_request_principal(request, user, auth)  # ok
"""
    msg = (
        "S033 Don't assign request.user or request.auth directly; call "
        "set_request_principal(request, user, auth)."
    )
    assert _run(src, filename="src/sentry/example.py") == [
        f"t.py:2:4: {msg}",
        f"t.py:3:4: {msg}",
        f"t.py:4:4: {msg}",
        f"t.py:5:4: {msg}",
        f"t.py:5:18: {msg}",
        f"t.py:6:4: {msg}",
        f"t.py:7:4: {msg}",
    ]
    assert _run(src, filename="src/sentry/auth/principal.py") == []
    assert _run(src, filename="tests/sentry/example.py") == []
