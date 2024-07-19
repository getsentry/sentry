from sentry.auth.system import SystemToken, get_system_token, is_system_auth
from sentry.testutils.cases import TestCase
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.silo import control_silo_test


@control_silo_test
class TestSystemAuth(TestCase):
    def test_is_system_auth(self):
        token = SystemToken()
        assert is_system_auth(token)
        assert not is_system_auth({})


@django_db_all
@control_silo_test
def test_system_token_option():
    from sentry import options

    options.delete("sentry:system-token")
    try:
        get_system_token()
        assert (
            options.get_last_update_channel("sentry:system-token")
            == options.UpdateChannel.APPLICATION
        )
    finally:
        options.delete("sentry:system-token")
