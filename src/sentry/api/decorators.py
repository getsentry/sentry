from functools import wraps

from sentry.api.exceptions import EmailVerificationRequired, SudoRequired
from sentry.models import ApiKey, ApiToken


def is_considered_sudo(request):
    # Right now, only password reauthentication (django-sudo) is supported,
    # so if a user doesn't have a password (for example, only has github auth)
    # then we shouldn't prompt them for the password they don't have.
    return (
        request.is_sudo()
        or isinstance(request.auth, ApiKey)
        or isinstance(request.auth, ApiToken)
        or request.user.is_authenticated
        and not request.user.has_usable_password()
    )


def sudo_required(func):
    @wraps(func)
    def wrapped(self, request, *args, **kwargs):
        # If we are already authenticated through an API key we do not
        # care about the sudo flag.
        if not is_considered_sudo(request):
            # TODO(dcramer): support some kind of auth flow to allow this
            # externally
            raise SudoRequired(request.user)
        return func(self, request, *args, **kwargs)

    return wrapped


def email_verification_required(func):
    @wraps(func)
    def wrapped(self, request, *args, **kwargs):
        if not request.user.get_verified_emails().exists():
            raise EmailVerificationRequired(request.user)
        return func(self, request, *args, **kwargs)

    return wrapped
