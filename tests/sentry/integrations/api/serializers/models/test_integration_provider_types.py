import types
from typing import (
    Annotated,
    Any,
    NotRequired,
    Required,
    Union,
    get_args,
    get_origin,
    get_type_hints,
)

import pytest
from typing_extensions import is_typeddict

from sentry.integrations.api.serializers.models.integration import (
    IntegrationAspects,
    IntegrationMetadataResponse,
)
from sentry.integrations.manager import default_manager as integrations
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.utils import json


def _check(value: object, hint: Any, path: str) -> None:
    """Fails unless `value` matches `hint`, with no keys a TypedDict doesn't declare."""
    origin = get_origin(hint)
    if origin in (Annotated, NotRequired, Required):
        return _check(value, get_args(hint)[0], path)
    if origin in (Union, types.UnionType):
        errors = []
        for branch in get_args(hint):
            try:
                return _check(value, branch, path)
            except AssertionError as e:
                errors.append(str(e))
        raise AssertionError(" / ".join(errors))
    if is_typeddict(hint):
        assert isinstance(value, dict), f"{path}: expected an object, got {value!r}"
        fields = get_type_hints(hint, include_extras=True)
        assert not (extra := set(value) - set(fields)), f"{path}: undeclared keys {extra}"
        missing = hint.__required_keys__ - set(value)
        assert not missing, f"{path}: missing keys {missing}"
        for key, item in value.items():
            _check(item, fields[key], f"{path}.{key}")
        return
    if origin is list:
        assert isinstance(value, list), f"{path}: expected a list, got {value!r}"
        for index, item in enumerate(value):
            _check(item, get_args(hint)[0], f"{path}[{index}]")
        return
    if hint is type(None):
        assert value is None, f"{path}: expected null, got {value!r}"
        return
    # bool is an int subclass, so compare types exactly.
    assert type(value) is hint, f"{path}: expected {hint.__name__}, got {value!r}"


def _rendered(value: object) -> Any:
    """The value as the API renders it, with lazy translations turned into strings."""
    return json.loads(json.dumps(value))


@django_db_all
def test_provider_metadata_matches_response_type() -> None:
    # Provider metadata is hand-written per integration and only cast to the response
    # TypedDict, so check what every provider actually returns.
    metadata = {
        provider.key: provider.metadata
        for provider in integrations.all()
        if provider.metadata is not None
    }
    assert any(m.aspects for m in metadata.values())
    for key, m in metadata.items():
        _check(_rendered(m.asdict()), IntegrationMetadataResponse, key)


@pytest.mark.parametrize(
    "drifted",
    [
        {"externalInstall": {"url": "u", "buttonText": "b"}},
        {"externalInstall": {"url": "u", "buttonText": "b", "noticeText": "n", "extra": "x"}},
        {"directEnable": "yes"},
        {"unknown": True},
    ],
)
def test_rejects_drift(drifted: dict[str, object]) -> None:
    _check({"directEnable": True}, IntegrationAspects, "aspects")
    with pytest.raises(AssertionError):
        _check(drifted, IntegrationAspects, "aspects")
