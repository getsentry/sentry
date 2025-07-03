# import serializer from rest_framework

from rest_framework.request import Request

from sentry.api.serializers import Serializer

# import model from models.py
from .types import SessionData


class SessionSerializer(Serializer):
    """
    These are the keys available when calling request.session.keys()
    https://docs.djangoproject.com/en/5.2/topics/http/sessions/#django.contrib.sessions.backends.base.SessionBase
    """

    def serialize(self, request: Request) -> dict:
        """
        This serializer takes in the entire request object because it needs to access
        the CSRF token
        """
        session: SessionData = request.session
        return {
            # Flags to control the authentication flow on frontend.
            # NOTE(dlee): Keep the keys sorted in order of importance!!
            "todo_email_verification": session.get("todo_email_verification"),
            "todo_2fa_verification": session.get("todo_2fa_verification"),
            # Post-authentication data
            "user_id": session.get("_auth_user_id"),
            "session_csrf_token": request.META.get("CSRF_COOKIE"),
            "session_expiry_date": session.get_expiry_date(),
            "session_orgs": session.get("session_orgs"),
        }
