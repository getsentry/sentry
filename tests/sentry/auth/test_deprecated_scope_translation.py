from collections.abc import Generator
from unittest.mock import MagicMock, patch

import pytest
from django.test import override_settings

from sentry.auth.deprecated_scope_translation import (
    get_deprecated_scope_translations,
    record_deprecated_scope_translation,
    translate_deprecated_scopes,
)
from sentry.testutils.helpers.options import override_options

ORG_READ_GRANULAR_SCOPES = frozenset(
    {
        "dashboard:read",
        "dashboard:write",
        "saved_query:read",
        "saved_query:write",
        "user_preference:read",
        "user_preference:write",
    }
)
USER_PREFERENCE_SCOPES = frozenset({"user_preference:read", "user_preference:write"})


@pytest.fixture(autouse=True)
def deprecated_scope_translation_enabled() -> Generator[None]:
    with override_options({"auth.deprecated-scope-translation.enabled": True}):
        yield


def test_translate_org_read_adds_granular_scopes() -> None:
    assert translate_deprecated_scopes(["org:read"]) == {"org:read"} | ORG_READ_GRANULAR_SCOPES


def test_translate_member_read_adds_user_preference_scopes() -> None:
    assert translate_deprecated_scopes(["member:read"]) == {"member:read"} | USER_PREFERENCE_SCOPES


def test_translate_org_read_keeps_org_read() -> None:
    # org:read maps to itself until every endpoint it gates has a granular replacement.
    assert "org:read" in translate_deprecated_scopes(["org:read"])


@override_settings(DEPRECATED_SCOPE_TRANSLATIONS={"org:read": frozenset({"dashboard:read"})})
def test_translate_replaces_deprecated_scope() -> None:
    assert translate_deprecated_scopes(["org:read", "project:read"]) == {
        "dashboard:read",
        "project:read",
    }


def test_translate_keeps_untranslated_scopes() -> None:
    assert translate_deprecated_scopes(["project:read", "event:write"]) == {
        "project:read",
        "event:write",
    }


def test_translate_empty() -> None:
    assert translate_deprecated_scopes([]) == frozenset()


@override_options({"auth.deprecated-scope-translation.enabled": False})
def test_translate_disabled_returns_scopes_unchanged() -> None:
    assert translate_deprecated_scopes(["org:read", "project:read"]) == {
        "org:read",
        "project:read",
    }


def test_get_deprecated_scope_translations_only_reports_added_scopes() -> None:
    assert get_deprecated_scope_translations(["org:read", "dashboard:read"]) == {
        "org:read": ORG_READ_GRANULAR_SCOPES - {"dashboard:read"}
    }


def test_get_deprecated_scope_translations_skips_scopes_already_held() -> None:
    assert get_deprecated_scope_translations(["org:read", *ORG_READ_GRANULAR_SCOPES]) == {}


def test_deprecated_scope_without_replacements_is_unchanged() -> None:
    assert translate_deprecated_scopes(["project:read"]) == {"project:read"}
    assert get_deprecated_scope_translations(["project:read"]) == {}


def test_get_deprecated_scope_translations_without_deprecated_scopes() -> None:
    assert get_deprecated_scope_translations(["project:read"]) == {}


@patch("sentry.auth.deprecated_scope_translation.sentry_sdk.metrics")
def test_record_deprecated_scope_translation(mock_metrics: MagicMock) -> None:
    record_deprecated_scope_translation(["org:read"], tags={"endpoint": "SomeEndpoint"})
    mock_metrics.count.assert_called_once_with(
        "auth.deprecated_scope_translation.applied",
        1,
        attributes={"endpoint": "SomeEndpoint", "deprecated_scope": "org:read"},
    )


@patch("sentry.auth.deprecated_scope_translation.sentry_sdk.metrics")
def test_record_deprecated_scope_translation_noop_without_added_scopes(
    mock_metrics: MagicMock,
) -> None:
    record_deprecated_scope_translation(["project:read"], tags={"endpoint": "SomeEndpoint"})
    mock_metrics.count.assert_not_called()


@override_options({"auth.deprecated-scope-translation.enabled": False})
@patch("sentry.auth.deprecated_scope_translation.sentry_sdk.metrics")
def test_record_deprecated_scope_translation_noop_when_disabled(mock_metrics: MagicMock) -> None:
    record_deprecated_scope_translation(["org:read"], tags={"endpoint": "SomeEndpoint"})
    mock_metrics.count.assert_not_called()
