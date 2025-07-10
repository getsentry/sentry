from rest_framework.request import Request


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

        # Flags to control the authentication flow on frontend.
        # Keep the keys sorted in order of importance!!
        # Maintaining the hierarchy is good context for future engineers.
        if session.get("todo_email_verification") is None:
            session["todo_email_verification"] = not user.has_verified_primary_email()
        if session.get("todo_2fa_verification") is None:
            session["todo_2fa_verification"] = user.has_2fa()
        if session.get("todo_password_reset") is None:
            session["todo_password_reset"] = (
                user.is_password_expired or not user.has_usable_password()
            )
        if session.get("todo_2fa_setup") is None:
            session["todo_2fa_setup"] = user.has_org_requiring_2fa()
