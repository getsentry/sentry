from __future__ import annotations

import ast
from datetime import datetime, timezone

from tools.flake8_plugin import SentryCheck, _s015_msg


def _run(src: str, filename: str = "getsentry/t.py") -> list[str]:
    tree = ast.parse(src)
    errors = sorted(SentryCheck(tree=tree, filename=filename).run())
    return ["t.py:{}:{}: {}".format(*error) for error in errors]


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


# --- S022: PUBLIC methods must declare a response shape ---


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
