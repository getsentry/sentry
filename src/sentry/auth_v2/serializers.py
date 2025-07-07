# import serializer from rest_framework

from datetime import datetime
from typing import TypedDict

from rest_framework.request import Request

from sentry.api.serializers import Serializer

from .types import SessionData


class SessionSerializerResponse(TypedDict, total=False):
    # Flags to control the authentication flow on frontend.
    # NOTE(dlee): Keep the keys sorted in order of importance!! Maintaining the control flow hierarchy on the serializer is good context for future engineers.
    todoEmailVerification: bool
    todo2faVerification: bool

    userId: str
    sessionCsrfToken: str
    sessionExpiryDate: datetime
    sessionOrgs: list[str]


class SessionSerializer(Serializer):
    """
    These are the keys available when calling request.session.keys()
    https://docs.djangoproject.com/en/5.2/topics/http/sessions/#django.contrib.sessions.backends.base.SessionBase
    """

    def serialize(self, request: Request) -> SessionSerializerResponse:
        """
        This serializer takes in the entire request object because it needs to access
        the CSRF token
        """
        session: SessionData = request.session
        return {
            # Flags to control the authentication flow on frontend.
            # NOTE(dlee): Keep the keys sorted in order of importance!! Maintaining the control flow hierarchy on the serializer is good context for future engineers.
            "todoEmailVerification": session.get("todo_email_verification"),
            "todo2faVerification": session.get("todo_2fa_verification"),
            # Post-authenticated session data
            "userId": session.get("_auth_user_id"),
            "sessionCsrfToken": request.META.get("CSRF_COOKIE"),
            "sessionExpiryDate": session.get_expiry_date(),
            "sessionOrgs": session.get("session_orgs"),
        }
