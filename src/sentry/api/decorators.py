from functools import wraps

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.exceptions import EmailVerificationRequired, SudoRequired
from sentry.models import ApiKey
from sentry.models.apitoken import is_api_token_auth
from sentry.models.user import User
from sentry.services.hybrid_cloud.user import APIUser


def is_considered_sudo(request):
    # Right now, only password reauthentication (django-sudo) is supported,
    # so if a user doesn't have a password (for example, only has github auth)
    # then we shouldn't prompt them for the password they don't have.
    return (
        request.is_sudo()
        or isinstance(request.auth, ApiKey)
        or is_api_token_auth(request.auth)
        or request.user.is_authenticated
        and not request.user.has_usable_password()
    )


def sudo_required(func):
    @wraps(func)
    def wrapped(self, request: Request, *args, **kwargs) -> Response:
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
    def wrapped(self, request: Request, *args, **kwargs) -> Response:
        if isinstance(request.user, User):
            if not request.user.get_verified_emails().exists():
                raise EmailVerificationRequired(request.user)
        elif isinstance(request.user, APIUser):
            has_verified_email = False
            for email in request.user.useremails:
                if email.is_verified:
                    has_verified_email = True
                    break
            if not has_verified_email:
                raise EmailVerificationRequired(request.user)
        else:
            raise NotImplementedError(
                "email_verification_required doesn't handle this type of user input"
            )
        return func(self, request, *args, **kwargs)

    return wrapped
