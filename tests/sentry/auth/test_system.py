from __future__ import absolute_import

from sentry.auth.system import is_system_auth, SystemToken
from sentry.testutils import TestCase


class TestSystemAuth(TestCase):
    def test_is_system_auth(self):
        token = SystemToken()
        assert is_system_auth(token)
        assert not is_system_auth({})
