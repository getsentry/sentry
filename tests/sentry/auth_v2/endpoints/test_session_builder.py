from unittest.mock import Mock

from django.contrib.sessions.backends.base import SessionBase
from rest_framework.request import Request

from sentry.auth_v2.endpoints.session_builder import SessionBuilder
from sentry.testutils.cases import TestCase


class MockSession(SessionBase):
    """Mock session class for testing."""

    def __init__(self):
        self.data = {}

    def get(self, key, default=None):
        return self.data.get(key, default)

    def __getitem__(self, key):
        return self.data[key]

    def __setitem__(self, key, value):
        self.data[key] = value

    def __contains__(self, key):
        return key in self.data


class SessionBuilderTest(TestCase):
    def setUp(self):
        self.request = Mock(spec=Request)
        self.request.session = MockSession()
        self.session_builder = SessionBuilder(self.request)

        # We cannot use self.create_user() because we need to mock a lot of methods.
        self.user = Mock()
        self.user.is_anonymous = False

    def test_initialize_auth_flags_no_user(self):
        self.request.user = None
        self.session_builder.initialize_auth_flags()
        assert len(self.request.session.data) == 0

    def test_initialize_auth_flags_anonymous_user(self):
        self.user.is_anonymous = True
        self.request.user = self.user
        self.session_builder.initialize_auth_flags()
        assert len(self.request.session.data) == 0

    def test_initialize_auth_flags_all_flags_false(self):
        self.user.has_verified_primary_email.return_value = True
        self.user.has_2fa.return_value = False
        self.user.is_password_expired = False
        self.user.has_usable_password.return_value = True
        self.user.has_org_requiring_2fa.return_value = False

        self.request.user = self.user
        self.session_builder.initialize_auth_flags()

        expected_flags = {
            "todo_email_verification": False,
            "todo_2fa_verification": False,
            "todo_password_reset": False,
            "todo_2fa_setup": False,
        }

        assert self.request.session.data == expected_flags
        assert len(self.request.session.data) == len(expected_flags.keys())

    def test_initialize_auth_flags_all_flags_true(self):
        self.user.has_verified_primary_email.return_value = False
        self.user.has_2fa.return_value = True
        self.user.is_password_expired = True
        self.user.has_usable_password.return_value = False
        self.user.has_org_requiring_2fa.return_value = True

        self.request.user = self.user
        self.session_builder.initialize_auth_flags()

        expected_flags = {
            "todo_email_verification": True,
            "todo_2fa_verification": True,
            "todo_password_reset": True,
            "todo_2fa_setup": True,
        }

        assert self.request.session.data == expected_flags
        assert len(self.request.session.data) == len(expected_flags.keys())

    def test_initialize_auth_flags_todo_password_reset(self):
        # Password is expired and usable
        self.user.is_password_expired = True
        self.user.has_usable_password.return_value = True
        self.request.user = self.user
        self.session_builder.initialize_auth_flags()

        assert self.request.session.data["todo_password_reset"] is True

        # Reset session
        self.request.session = MockSession()
        self.session_builder = SessionBuilder(self.request)

        # Password is not expired and usable
        self.user.is_password_expired = False
        self.user.has_usable_password.return_value = True
        self.session_builder.initialize_auth_flags()
        assert self.request.session.data["todo_password_reset"] is False

        # Reset session
        self.request.session = MockSession()
        self.session_builder = SessionBuilder(self.request)

        # Password is not expired and not usable
        self.user.is_password_expired = False
        self.user.has_usable_password.return_value = False
        self.session_builder.initialize_auth_flags()
        assert self.request.session["todo_password_reset"] is True
