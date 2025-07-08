from collections.abc import Mapping
from datetime import datetime
from typing import Any, TypedDict

from django.contrib.auth.models import AnonymousUser
from rest_framework.request import Request

from sentry.api.serializers import Serializer
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser


class SessionSerializerResponse(TypedDict, total=False):
    # Flags to control the authentication flow on frontend.
    # NOTE(dlee): Keep the keys sorted in order of importance!! Maintaining the control flow hierarchy on the serializer is good context for future engineers.
    todoEmailVerification: bool | None
    todo2faVerification: bool | None

    userId: str | None
    sessionCsrfToken: str | None
    sessionExpiryDate: datetime | None
    sessionOrgs: list[str] | None


class SessionSerializer(Serializer):
    """
    These are the keys available when calling request.session.keys()
    https://docs.djangoproject.com/en/5.2/topics/http/sessions/#django.contrib.sessions.backends.base.SessionBase
    """

    def serialize(
        self,
        obj: Request,
        attrs: Mapping[Any, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> SessionSerializerResponse:
        """
        This serializer takes in the entire request object because it needs to access
        the CSRF token
        """
        session = obj.session
        return {
            # Flags to control the authentication flow on frontend.
            # NOTE(dlee): Keep the keys sorted in order of importance!! Maintaining the control flow hierarchy on the serializer is good context for future engineers.
            "todoEmailVerification": session.get("todo_email_verification"),
            "todo2faVerification": session.get("todo_2fa_verification"),
            # Post-authenticated session data
            "userId": session.get("_auth_user_id"),
            "sessionCsrfToken": obj.META.get("CSRF_COOKIE"),
            "sessionExpiryDate": session.get_expiry_date(),
            "sessionOrgs": session.get("session_orgs"),
        }
