from functools import wraps

from sentry.api.exceptions import EmailVerificationRequired, SudoRequired
from sentry.models import ApiKey, ApiToken


def is_considered_sudo(request):
    # Users without a password are assumed to always have sudo powers
    user = request.user

    return (
        request.is_sudo()
        or isinstance(request.auth, ApiKey)
        or isinstance(request.auth, ApiToken)
        or user.is_authenticated
        and not user.has_usable_password()
    )


def has_verified_email(request):
    user = request.user
    return request.user.get_verified_emails().filter(email=user.email).exists()


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
        if not has_verified_email(request):
            raise EmailVerificationRequired(request.user)
        return func(self, request, *args, **kwargs)

    return wrapped
