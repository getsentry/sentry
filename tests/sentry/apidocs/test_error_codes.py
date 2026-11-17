import ast
import gc
import inspect
import textwrap
from typing import Any

import pytest

from sentry.api import exceptions
from sentry.api.exceptions import SentryAPIException
from sentry.apidocs.error_codes import sentry_api_error_schema, sentry_api_exceptions
from sentry.apidocs.utils import SentryApiBuildError


def _variants() -> dict[str, dict[str, Any]]:
    return {
        variant["title"]: variant
        for variant in sentry_api_error_schema()["properties"]["detail"]["oneOf"]
    }


def test_publishes_every_code_in_the_exceptions_module() -> None:
    variants = _variants()
    defined = [
        cls
        for _, cls in inspect.getmembers(exceptions, inspect.isclass)
        if issubclass(cls, SentryAPIException) and cls.code
    ]
    assert defined
    for cls in defined:
        variant = variants[cls.code]
        assert variant["x-sentry-status"] == cls.status_code
        assert variant["properties"]["code"]["enum"] == [cls.code]
        assert list(variant["properties"]["extra"]["properties"]) == list(cls.extra_keys)


def test_describes_the_detail_shape() -> None:
    assert _variants()["sso-required"] == {
        "type": "object",
        "title": "sso-required",
        "required": ["code", "message", "extra"],
        "properties": {
            "code": {"type": "string", "enum": ["sso-required"]},
            "message": {"type": "string"},
            "extra": {
                "type": "object",
                "properties": {
                    "loginUrl": {"type": "string"},
                    "organizationSlug": {"type": "string"},
                },
            },
        },
        "x-sentry-status": 401,
        "x-sentry-auth-challenge": True,
    }
    assert list(_variants()) == sorted(_variants())


def _init_extra_keys(cls: type[SentryAPIException]) -> set[str]:
    """The keywords `cls.__init__` passes to `super().__init__`, which become `extra`."""
    tree = ast.parse(textwrap.dedent(inspect.getsource(cls.__init__)))
    keys: set[str] = set()
    for node in ast.walk(tree):
        if (
            isinstance(node, ast.Call)
            and isinstance(node.func, ast.Attribute)
            and node.func.attr == "__init__"
            and isinstance(node.func.value, ast.Call)
            and isinstance(node.func.value.func, ast.Name)
            and node.func.value.func.id == "super"
        ):
            keys |= {
                keyword.arg
                for keyword in node.keywords
                if keyword.arg is not None and keyword.arg not in ("code", "message", "detail")
            }
    return keys


@pytest.mark.parametrize("cls", sentry_api_exceptions(), ids=lambda cls: cls.code)
def test_extra_keys_match_init(cls: type[SentryAPIException]) -> None:
    if "__init__" not in vars(cls):
        return
    passed = _init_extra_keys(cls)
    takes_any = any(
        parameter.kind is inspect.Parameter.VAR_KEYWORD
        for parameter in inspect.signature(cls.__init__).parameters.values()
    )
    if takes_any:
        assert passed <= set(cls.extra_keys)
    else:
        assert passed == set(cls.extra_keys)


@pytest.mark.parametrize("cls", sentry_api_exceptions(), ids=lambda cls: cls.code)
def test_auth_challenge_is_decided_for_401_and_403(cls: type[SentryAPIException]) -> None:
    # A new 401 or 403 code must say whether it is an auth challenge, so clients
    # that read `x-sentry-auth-challenge` don't miss it.
    if cls.status_code in (401, 403):
        assert "auth_challenge" in vars(cls), f"{cls.__qualname__} must set auth_challenge"
    else:
        assert not cls.auth_challenge


def test_publishes_auth_challenges() -> None:
    challenges = sorted(
        code for code, variant in _variants().items() if variant["x-sentry-auth-challenge"]
    )
    assert challenges == [
        "2fa-required",
        "member-disabled-over-limit",
        "primary-email-verification-required",
        "sso-required",
        "staff-required",
        "sudo-required",
        "superuser-required",
    ]


def test_rejects_one_code_with_two_statuses() -> None:
    class First(SentryAPIException):
        status_code = 400
        code = "test-duplicate-code"

    class Second(SentryAPIException):
        status_code = 404
        code = "test-duplicate-code"

    try:
        with pytest.raises(SentryApiBuildError, match="test-duplicate-code"):
            sentry_api_exceptions()
    finally:
        del First, Second
        gc.collect()
