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
    # Keep the keys sorted in order of importance!!
    # Maintaining the hierarchy is good context for future engineers.
    todoEmailVerification: bool | None
    todo2faVerification: bool | None
    todoPasswordReset: bool | None
    todo2faSetup: bool | None

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
            # Keep the keys sorted in order of importance!!
            "todoEmailVerification": session.get("todo_email_verification"),
            "todo2faVerification": session.get("todo_2fa_verification"),
            "todoPasswordReset": session.get("todo_password_reset"),
            "todo2faSetup": session.get("todo_2fa_setup"),
            # Post-authenticated session data
            "userId": session.get("_auth_user_id"),
            "sessionCsrfToken": obj.META.get("CSRF_COOKIE"),
            "sessionExpiryDate": session.get_expiry_date(),
            "sessionOrgs": session.get("session_orgs"),
        }


class SessionBuilder:
    """
    Manages authentication session state and flags.

    This class sets session flags that control the authentication
    flow on the frontend, based on the current user's state.
    """

    def __init__(self, request: Request):
        self.request = request

    def initialize_auth_flags(self) -> None:
        """
        Initialize authentication flow flags in the session.

        This method sets flags that control what authentication steps
        the user needs to complete on the frontend. Flags are only
        set if they don't already exist in the session.
        """
        user = self.request.user
        if not user or user.is_anonymous:
            return

        session = self.request.session

        # Keep the keys sorted in order of importance!!
        if session.get("todo_email_verification") is None:
            session["todo_email_verification"] = not user.has_verified_primary_email()
        if session.get("todo_2fa_verification") is None:
            session["todo_2fa_verification"] = user.has_2fa()
        if session.get("todo_password_reset") is None:
            session["todo_password_reset"] = (
                user.is_password_expired or not user.has_usable_password()
            )
        if session.get("todo_2fa_setup") is None:
            session["todo_2fa_setup"] = user.has_org_requiring_2fa() and not user.has_2fa()
