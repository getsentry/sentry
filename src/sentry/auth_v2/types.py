from typing import TypedDict


class SessionData(TypedDict, total=False):
    """
    These are the keys available when calling request.session.keys()
    https://docs.djangoproject.com/en/5.2/topics/http/sessions/#django.contrib.sessions.backends.base.SessionBase
    """

    # Flags to control the authentication flow on frontend.
    # NOTE(dlee): Keep the keys sorted in order of importance!!
    todo_email_verification: bool
    todo_2fa_verification: bool

    # Authentication related
    _auth_user_id: str  # Django's internal user ID storage
    _auth_user_backend: str  # Authentication backend used
    _auth_user_hash: str  # Hash of user's authentication data

    # Sentry-specific session data
    org_sessions: list[str] | None  # List of org IDs

    # Any other custom session data
    # [key: str]: Union[str, int, bool, Dict, list, None]
