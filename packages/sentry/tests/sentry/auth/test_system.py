from sentry.auth.system import SystemToken, is_system_auth
from sentry.testutils import TestCase


class TestSystemAuth(TestCase):
    def test_is_system_auth(self):
        token = SystemToken()
        assert is_system_auth(token)
        assert not is_system_auth({})
