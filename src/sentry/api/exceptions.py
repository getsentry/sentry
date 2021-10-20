from typing import List, Optional

from django.urls import reverse
from rest_framework import status
from rest_framework.exceptions import APIException


class ResourceDoesNotExist(APIException):
    status_code = status.HTTP_404_NOT_FOUND
    default_detail = "The requested resource does not exist"


class SentryAPIException(APIException):
    code = ""
    message = ""

    def __init__(self, code=None, message=None, detail=None, **kwargs):
        # Note that we no longer call the base `__init__` here. This is because
        # DRF now forces all detail messages that subclass `APIException` to a
        # string, which breaks our format.
        # https://www.django-rest-framework.org/community/3.0-announcement/#miscellaneous-notes
        if detail is None:
            detail = {
                "code": code or self.code,
                "message": message or self.message,
                "extra": kwargs,
            }

        self.detail = {"detail": detail}


class ParameterValidationError(SentryAPIException):
    status_code = status.HTTP_400_BAD_REQUEST
    code = "parameter-validation-error"

    def __init__(self, message: str, context: Optional[List[str]] = None) -> None:
        super().__init__(message=message, context=".".join(context or []))


class ProjectMoved(SentryAPIException):
    status_code = status.HTTP_302_FOUND
    # code/message currently don't get used
    code = "resource-moved"
    message = "Resource has been moved"

    def __init__(self, new_url, slug):
        super().__init__(url=new_url, slug=slug)


class SsoRequired(SentryAPIException):
    status_code = status.HTTP_401_UNAUTHORIZED
    code = "sso-required"
    message = "Must login via SSO"

    def __init__(self, organization):
        super().__init__(loginUrl=reverse("sentry-auth-organization", args=[organization.slug]))


class MemberDisabledOverLimit(SentryAPIException):
    status_code = status.HTTP_401_UNAUTHORIZED
    code = "member-disabled-over-limit"
    message = "Organization over member limit"

    def __init__(self, organization):
        super().__init__(
            next=reverse("sentry-organization-disabled-member", args=[organization.slug])
        )


class SuperuserRequired(SentryAPIException):
    status_code = status.HTTP_403_FORBIDDEN
    code = "superuser-required"
    message = "You need to re-authenticate for superuser."


class SudoRequired(SentryAPIException):
    status_code = status.HTTP_401_UNAUTHORIZED
    code = "sudo-required"
    message = "Account verification required."

    def __init__(self, user):
        super().__init__(username=user.username)


class EmailVerificationRequired(SentryAPIException):
    status_code = status.HTTP_401_UNAUTHORIZED
    code = "email-verification-required"
    message = "Email verification required."

    def __init__(self, user):
        super().__init__(username=user.username)


class TwoFactorRequired(SentryAPIException):
    status_code = status.HTTP_401_UNAUTHORIZED
    code = "2fa-required"
    message = "Organization requires two-factor authentication to be enabled"


class AppConnectAuthenticationError(SentryAPIException):
    status_code = status.HTTP_401_UNAUTHORIZED
    code = "app-connect-authentication-error"
    message = "App connect authentication error"


class AppConnectMultipleSourcesError(SentryAPIException):
    status_code = status.HTTP_401_UNAUTHORIZED
    code = "app-connect-multiple-sources-error"
    message = "Only one Apple App Store Connect application is allowed in this project"


class ItunesAuthenticationError(SentryAPIException):
    status_code = status.HTTP_401_UNAUTHORIZED
    code = "itunes-authentication-error"
    message = "Itunes authentication error"


class ItunesSmsBlocked(SentryAPIException):
    status_code = status.HTTP_423_LOCKED
    code = "itunes-sms-blocked-error"
    message = "Blocked from requesting more SMS codes for an unspecified period of time"


class ItunesTwoFactorAuthenticationRequired(SentryAPIException):
    status_code = status.HTTP_401_UNAUTHORIZED
    code = "itunes-2fa-required"
    message = "Itunes requires two-factor authentication to be enabled"


class ConflictError(APIException):
    status_code = status.HTTP_409_CONFLICT


class InvalidRepository(Exception):
    pass
