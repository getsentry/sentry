from django.contrib.sessions.backends.base import SessionBase


class SessionData(SessionBase):
    """
    These are the keys available when calling request.session.keys()
    https://docs.djangoproject.com/en/5.2/topics/http/sessions/#django.contrib.sessions.backends.base.SessionBase
    """

    # Flags to control the authentication flow on frontend.
    # Keep the keys sorted in order of importance!!
    # Maintaining the hierarchy is good context for future engineers.
    todo_email_verification: bool | None
    todo_2fa_verification: bool | None
    todo_password_reset: bool | None
    todo_2fa_setup: bool | None

    # Django's internal session data
    _auth_user_id: str | None  # Django's internal user ID storage
    _auth_user_backend: str | None  # Authentication backend used
    _auth_user_hash: str | None  # Hash of user's authentication data

    # Sentry-specific session data
    session_orgs: list[str] | None  # List of org IDs

    # Any other custom session data
    # [key: str]: Union[str, int, bool, Dict, list, None]
