from django.utils.translation import ugettext


class SocialAuthBaseException(ValueError):
    """Base class for pipeline exceptions."""


class BackendError(SocialAuthBaseException):
    def __str__(self):
        return ugettext("Backend error: %s" % self.message)


class WrongBackend(BackendError):
    def __init__(self, backend_name):
        self.backend_name = backend_name

    def __str__(self):
        return ugettext('Incorrect authentication service "%s"') % self.backend_name


class StopPipeline(SocialAuthBaseException):
    """Stop pipeline process exception.
    Raise this exception to stop the rest of the pipeline process.
    """

    def __str__(self):
        return ugettext("Stop pipeline")


class AuthException(SocialAuthBaseException):
    """Auth process exception."""

    def __init__(self, backend, *args, **kwargs):
        self.backend = backend
        super().__init__(*args, **kwargs)


class AuthFailed(AuthException):
    """Auth process failed for some reason."""

    def __str__(self):
        if self.message == "access_denied":
            return ugettext("Authentication process was cancelled")
        else:
            return ugettext("Authentication failed: %s") % super().__str__()


class AuthCanceled(AuthException):
    """Auth process was canceled by user."""

    def __str__(self):
        return ugettext("Authentication process canceled")


class AuthUnknownError(AuthException):
    """Unknown auth process error."""

    def __str__(self):
        err = "An unknown error happened while authenticating %s"
        return ugettext(err) % super().__str__()


class AuthTokenError(AuthException):
    """Auth token error."""

    def __str__(self):
        msg = super().__str__()
        return ugettext("Token error: %s") % msg


class AuthMissingParameter(AuthException):
    """Missing parameter needed to start or complete the process."""

    def __init__(self, backend, parameter, *args, **kwargs):
        self.parameter = parameter
        super().__init__(backend, *args, **kwargs)

    def __str__(self):
        return ugettext("Missing needed parameter %s") % self.parameter


class AuthStateMissing(AuthException):
    """State parameter is incorrect."""

    def __str__(self):
        return ugettext("Session value state missing.")


class AuthStateForbidden(AuthException):
    """State parameter is incorrect."""

    def __str__(self):
        return ugettext("Wrong state parameter given.")


class AuthTokenRevoked(AuthException):
    """User revoked the access_token in the provider."""

    def __str__(self):
        return ugettext("User revoke access to the token")
