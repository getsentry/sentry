from sentry import options
from sentry.auth.system import SystemToken, get_system_token, is_system_auth
from sentry.testutils import TestCase
from sentry.testutils.silo import control_silo_test
from sentry.utils.pytest.fixtures import django_db_all


@control_silo_test(stable=True)
class TestSystemAuth(TestCase):
    def test_is_system_auth(self):
        token = SystemToken()
        assert is_system_auth(token)
        assert not is_system_auth({})


@django_db_all
@control_silo_test(stable=True)
def test_system_token_option():
    get_system_token()
    assert (
        options.get_last_update_channel("sentry:system-token") == options.UpdateChannel.APPLICATION
    )
