from datetime import datetime
from unittest.mock import Mock

from django.contrib.sessions.backends.base import SessionBase
from rest_framework.request import Request

from sentry.auth_v2.utils.session import SessionBuilder, SessionSerializer
from sentry.testutils.cases import TestCase

EXPIRY_DATE = datetime(2023, 12, 31)


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

    def get_expiry_date(self, **kwargs):
        return EXPIRY_DATE


class SessionSerializerTest(TestCase):
    def setUp(self):
        self.serializer = SessionSerializer()

    def test_serialize_with_full_session_data(self):
        request = self.make_request(method="GET")
        request.session = MockSession()
        request.session.data = {
            "todo_email_verification": False,
            "todo_2fa_verification": True,
            "todo_password_reset": False,
            "todo_2fa_setup": False,
            "_auth_user_id": "123",
            "session_orgs": ["org1", "org2"],
        }
        request.META["CSRF_COOKIE"] = "csrf_token_value"

        result = self.serializer.serialize(obj=Request(request), attrs={}, user=self.user)

        assert result == {
            "todoEmailVerification": False,
            "todo2faVerification": True,
            "todoPasswordReset": False,
            "todo2faSetup": False,
            "userId": "123",
            "sessionCsrfToken": "csrf_token_value",
            "sessionExpiryDate": EXPIRY_DATE,
            "sessionOrgs": ["org1", "org2"],
        }

    def test_serialize_with_empty_session_data(self):
        request = self.make_request(method="GET")
        request.session = MockSession()
        request.META["CSRF_COOKIE"] = "csrf_token_value"

        result = self.serializer.serialize(obj=Request(request), attrs={}, user=self.user)

        assert result == {
            "todoEmailVerification": None,
            "todo2faVerification": None,
            "todoPasswordReset": None,
            "todo2faSetup": None,
            "userId": None,
            "sessionCsrfToken": "csrf_token_value",
            "sessionExpiryDate": EXPIRY_DATE,
            "sessionOrgs": None,
        }


class SessionBuilderTest(TestCase):
    def setUp(self):
        self.request = Mock(spec=Request)
        self.request.session = MockSession()
        self.session_builder = SessionBuilder(self.request)

    def create_mock_user(self, **kwargs):
        # Default attributes that should all evaluate to False
        attributes = {
            "has_verified_primary_email": True,
            "has_2fa": False,
            "has_usable_password": True,
            "has_org_requiring_2fa": False,
        }
        properties = {
            "is_anonymous": False,
            "is_password_expired": False,
        }

        for key, value in kwargs.items():
            if key in attributes:
                attributes[key] = value
            elif key in properties:
                properties[key] = value
            else:
                raise ValueError(f"Invalid attribute or property: {key}")

        mock_attributes = {}
        for key, value in attributes.items():
            mock_attributes[key] = Mock(return_value=value)
        for key, value in properties.items():
            mock_attributes[key] = value

        self.request.user = Mock(**mock_attributes)
        return self.request.user

    def test_initialize_does_not_override_flags(self):
        """
        Ensure that the session builder does not override flags that are already set.
        """
        expected_flags = {
            "todo_email_verification": False,
            "todo_2fa_verification": False,
            "todo_password_reset": False,
            "todo_2fa_setup": False,
        }

        # Set all flags to False
        for key, value in expected_flags.items():
            self.request.session[key] = value

        # Conditions would usually evaluate flags to all be True,
        self.request.user = self.create_mock_user(
            has_verified_primary_email=False,
            has_2fa=False,
            is_password_expired=True,
            has_usable_password=False,
            has_org_requiring_2fa=True,
        )
        self.session_builder.initialize_auth_flags()

        # Assert that the flags are not overridden
        assert self.request.session.data == expected_flags
        assert len(self.request.session.data) == len(expected_flags.keys())

    def test_initialize_no_user(self):
        self.request.user = None
        self.session_builder.initialize_auth_flags()
        assert len(self.request.session.data) == 0

    def test_initialize_anonymous_user(self):
        self.create_mock_user(is_anonymous=True)
        self.session_builder.initialize_auth_flags()
        assert len(self.request.session.data) == 0

    def test_initialize_all_flags_false(self):
        self.create_mock_user()
        self.session_builder.initialize_auth_flags()

        expected_flags = {
            "todo_email_verification": False,
            "todo_2fa_verification": False,
            "todo_password_reset": False,
            "todo_2fa_setup": False,
        }

        assert self.request.session.data == expected_flags
        assert len(self.request.session.data) == len(expected_flags.keys())

    def test_initialize_all_flags_true(self):
        self.request.user = self.create_mock_user(
            has_verified_primary_email=False,
            has_2fa=True,
            is_password_expired=True,
            has_usable_password=False,
            has_org_requiring_2fa=True,
        )
        self.session_builder.initialize_auth_flags()

        expected_flags = {
            "todo_email_verification": True,
            "todo_2fa_verification": True,
            "todo_password_reset": True,
            "todo_2fa_setup": False,  # False because user already has 2FA enabled
        }

        assert self.request.session.data == expected_flags
        assert len(self.request.session.data) == len(expected_flags.keys())

    def test_initialize_todo_password_reset(self):
        """
        todo_password_reset has 2 conditions that trigger it.
        """
        # Case 1:Password is expired and usable
        self.request.user = self.create_mock_user(
            is_password_expired=True,
            has_usable_password=True,
        )
        self.session_builder.initialize_auth_flags()

        assert self.request.session.data["todo_password_reset"] is True

        # Reset session
        self.request.session = MockSession()
        self.session_builder = SessionBuilder(self.request)

        # Case 2: Password is not expired and usable
        self.request.user = self.create_mock_user(
            is_password_expired=False,
            has_usable_password=True,
        )
        self.session_builder.initialize_auth_flags()
        assert self.request.session.data["todo_password_reset"] is False

        # Reset session
        self.request.session = MockSession()
        self.session_builder = SessionBuilder(self.request)

        # Case 3: Password is not expired and not usable
        self.request.user = self.create_mock_user(
            is_password_expired=False,
            has_usable_password=False,
        )
        self.session_builder.initialize_auth_flags()
        assert self.request.session["todo_password_reset"] is True

    def test_initialize_todo_2fa_setup_logic(self):
        # Case 1: User has org requiring 2FA but no 2FA enabled -> should be True
        self.request.user = self.create_mock_user(
            has_org_requiring_2fa=True,
            has_2fa=False,
        )
        self.session_builder.initialize_auth_flags()
        assert self.request.session.data["todo_2fa_setup"] is True

        # Reset session
        self.request.session = MockSession()
        self.session_builder = SessionBuilder(self.request)

        # Case 2: User has org requiring 2FA and already has 2FA enabled -> should be False
        self.request.user = self.create_mock_user(
            has_org_requiring_2fa=True,
            has_2fa=True,
        )
        self.session_builder.initialize_auth_flags()
        assert self.request.session.data["todo_2fa_setup"] is False

        # Reset session
        self.request.session = MockSession()
        self.session_builder = SessionBuilder(self.request)

        # Case 3: User doesn't have org requiring 2FA and no 2FA enabled -> should be False
        self.request.user = self.create_mock_user(
            has_org_requiring_2fa=False,
            has_2fa=False,
        )
        self.session_builder.initialize_auth_flags()
        assert self.request.session.data["todo_2fa_setup"] is False

        # Reset session
        self.request.session = MockSession()
        self.session_builder = SessionBuilder(self.request)

        # Case 4: User doesn't have org requiring 2FA but has 2FA enabled -> should be False
        self.request.user = self.create_mock_user(
            has_org_requiring_2fa=False,
            has_2fa=True,
        )
        self.session_builder.initialize_auth_flags()
        assert self.request.session.data["todo_2fa_setup"] is False
