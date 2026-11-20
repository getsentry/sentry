from unittest.mock import patch

from django.http import HttpRequest
from django.test import RequestFactory, override_settings
from django.utils.crypto import salted_hmac

from sentry import options
from sentry.auth.system import SystemToken, get_system_token, is_system_auth
from sentry.testutils.cases import TestCase
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.silo import control_silo_test


@control_silo_test
class TestSystemAuth(TestCase):
    def test_is_system_auth(self) -> None:
        token = SystemToken()
        assert is_system_auth(token)
        assert not is_system_auth({})


@django_db_all
@control_silo_test
def test_system_token_state() -> None:
    options.delete("sentry:system-token")
    try:
        with patch(
            "sentry.auth.system.secrets.token_hex", return_value="generated-system-token"
        ) as generate:
            assert get_system_token() == "generated-system-token"
            assert get_system_token() == "generated-system-token"
        generate.assert_called_once_with()
        row = options.default_store.model.objects.get(key="sentry:system-token")
        assert row.value == "generated-system-token"
        assert row.last_updated_by == options.UpdateChannel.APPLICATION.value
    finally:
        options.delete("sentry:system-token")


@django_db_all
@control_silo_test
def test_system_token_preserves_existing_value() -> None:
    options.default_store.set_store(
        options.default_manager.lookup_key("sentry:system-token"),
        "existing-system-token",
        channel=options.UpdateChannel.UNKNOWN,
    )
    options.default_store.delete_cache(options.default_manager.lookup_key("sentry:system-token"))
    try:
        with patch("sentry.auth.system.secrets.token_hex", side_effect=AssertionError):
            assert get_system_token() == "existing-system-token"
        row = options.default_store.model.objects.get(key="sentry:system-token")
        assert row.value == "existing-system-token"
    finally:
        options.delete("sentry:system-token")


def _system_request(remote_addr: str = "127.0.0.1") -> HttpRequest:
    return RequestFactory().get("/", REMOTE_ADDR=remote_addr)


def _derived_token() -> str:
    return salted_hmac("sentry.auth.system", "system-token", algorithm="sha256").hexdigest()


@django_db_all
@control_silo_test
@override_settings(SENTRY_SELF_HOSTED=False)
def test_saas_accepts_derived_and_stored_system_tokens() -> None:
    try:
        with patch("sentry.auth.system.is_internal_ip", return_value=True):
            assert SystemToken.from_request(_system_request(), _derived_token()) is not None
            assert SystemToken.from_request(_system_request(), get_system_token()) is not None
            assert SystemToken.from_request(_system_request(), "not-the-token") is None
    finally:
        options.delete("sentry:system-token")


@django_db_all
@control_silo_test
@override_settings(SENTRY_SELF_HOSTED=True)
def test_self_hosted_accepts_only_the_stored_system_token() -> None:
    try:
        with patch("sentry.auth.system.is_internal_ip", return_value=True):
            assert SystemToken.from_request(_system_request(), _derived_token()) is None
            assert SystemToken.from_request(_system_request(), get_system_token()) is not None
    finally:
        options.delete("sentry:system-token")


@django_db_all
@control_silo_test
@override_settings(SENTRY_SELF_HOSTED=False)
def test_saas_derived_system_token_requires_an_internal_ip() -> None:
    with patch("sentry.auth.system.is_internal_ip", return_value=False):
        assert SystemToken.from_request(_system_request("203.0.113.7"), _derived_token()) is None
