from datetime import datetime

from django.contrib.sessions.backends.base import SessionBase
from rest_framework.request import Request

from sentry.auth_v2.serializers import SessionSerializer
from sentry.testutils.cases import TestCase

EXPIRY_DATE = datetime(2023, 12, 31)


class MockSession(SessionBase):
    def get_expiry_date(self, **kwargs):
        return EXPIRY_DATE


class SessionSerializerTest(TestCase):
    def setUp(self):
        self.serializer = SessionSerializer()

    def test_serialize_with_full_session_data(self):
        request = self.make_request(method="GET")
        request.session = MockSession()
        request.session.update(
            {
                "todo_email_verification": False,
                "todo_2fa_verification": True,
                "todo_password_reset": False,
                "todo_2fa_setup": False,
                "_auth_user_id": "123",
                "session_orgs": ["org1", "org2"],
            }
        )
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
