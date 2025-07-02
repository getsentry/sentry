from django.contrib.sessions.backends.base import SessionBase

from sentry.auth_v2.serializers import SessionSerializer
from sentry.testutils.cases import TestCase


class SessionSerializerTest(TestCase):
    def setUp(self):
        self.serializer = SessionSerializer()

    def test_serialize_with_full_session_data(self):
        request = self.make_request(method="GET")
        request.session = SessionBase()
        request.session.get_expiry_date = lambda: "2023-12-31"
        request.session.update(
            {
                "todo_email_verification": False,
                "todo_2fa_verification": True,
                "_auth_user_id": "123",
                "session_orgs": ["org1", "org2"],
            }
        )
        request.META["CSRF_COOKIE"] = "csrf_token_value"

        result = self.serializer.serialize(request)

        assert result == {
            "todo_email_verification": False,
            "todo_2fa_verification": True,
            "user_id": "123",
            "session_csrf_token": "csrf_token_value",
            "session_expiry_date": "2023-12-31",
            "session_orgs": ["org1", "org2"],
        }

    def test_serialize_with_empty_session_data(self):
        request = self.make_request(method="GET")
        request.session = SessionBase()
        request.session.get_expiry_date = lambda: "2023-12-31"
        request.META["CSRF_COOKIE"] = "csrf_token_value"

        result = self.serializer.serialize(request)

        assert result == {
            "todo_email_verification": None,
            "todo_2fa_verification": None,
            "user_id": None,
            "session_csrf_token": "csrf_token_value",
            "session_expiry_date": "2023-12-31",
            "session_orgs": None,
        }
