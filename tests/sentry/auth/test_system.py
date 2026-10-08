from unittest.mock import patch

from sentry import application_state, options
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
    application_state.delete("sentry:system-token")
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
        application_state.delete("sentry:system-token")


@django_db_all
@control_silo_test
def test_system_token_preserves_existing_value() -> None:
    options.set("sentry:system-token", "existing-system-token")
    try:
        with patch("sentry.auth.system.secrets.token_hex", side_effect=AssertionError):
            assert get_system_token() == "existing-system-token"
        row = options.default_store.model.objects.get(key="sentry:system-token")
        assert row.value == "existing-system-token"
    finally:
        application_state.delete("sentry:system-token")
