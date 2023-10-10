from django.utils.translation import gettext


class SocialAuthBaseException(ValueError):
    """Base class for pipeline exceptions."""


class BackendError(SocialAuthBaseException):
    def __str__(self):
        return gettext("Backend error: %s") % super().__str__()


class WrongBackend(BackendError):
    def __init__(self, backend_name):
        self.backend_name = backend_name

    def __str__(self):
        return gettext('Incorrect authentication service "%s"') % self.backend_name


class StopPipeline(SocialAuthBaseException):
    """Stop pipeline process exception.
    Raise this exception to stop the rest of the pipeline process.
    """

    def __str__(self):
        return gettext("Stop pipeline")


class AuthException(SocialAuthBaseException):
    """Auth process exception."""

    def __init__(self, backend, *args, **kwargs):
        self.backend = backend
        super().__init__(*args, **kwargs)


class AuthFailed(AuthException):
    """Auth process failed for some reason."""

    def __str__(self):
        if self.args == ("access_denied",):
            return gettext("Authentication process was cancelled")
        else:
            return gettext("Authentication failed: %s") % super().__str__()


class AuthCanceled(AuthException):
    """Auth process was canceled by user."""

    def __str__(self):
        return gettext("Authentication process canceled")


class AuthUnknownError(AuthException):
    """Unknown auth process error."""

    def __str__(self):
        err = "An unknown error happened while authenticating %s"
        return gettext(err) % super().__str__()


class AuthTokenError(AuthException):
    """Auth token error."""

    def __str__(self):
        msg = super().__str__()
        return gettext("Token error: %s") % msg


class AuthMissingParameter(AuthException):
    """Missing parameter needed to start or complete the process."""

    def __init__(self, backend, parameter, *args, **kwargs):
        self.parameter = parameter
        super().__init__(backend, *args, **kwargs)

    def __str__(self):
        return gettext("Missing needed parameter %s") % self.parameter


class AuthStateMissing(AuthException):
    """State parameter is incorrect."""

    def __str__(self):
        return gettext("Session value state missing.")


class AuthStateForbidden(AuthException):
    """State parameter is incorrect."""

    def __str__(self):
        return gettext("Wrong state parameter given.")


class AuthTokenRevoked(AuthException):
    """User revoked the access_token in the provider."""

    def __str__(self):
        return gettext("User revoke access to the token")
