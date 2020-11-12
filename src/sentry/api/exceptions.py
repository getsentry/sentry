from __future__ import absolute_import

from django.core.urlresolvers import reverse
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


class ProjectMoved(SentryAPIException):
    status_code = status.HTTP_302_FOUND
    # code/message currently don't get used
    code = "resource-moved"
    message = "Resource has been moved"

    def __init__(self, new_url, slug):
        super(ProjectMoved, self).__init__(url=new_url, slug=slug)


class SsoRequired(SentryAPIException):
    status_code = status.HTTP_401_UNAUTHORIZED
    code = "sso-required"
    message = "Must login via SSO"

    def __init__(self, organization):
        super(SsoRequired, self).__init__(
            loginUrl=reverse("sentry-auth-organization", args=[organization.slug])
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
        super(SudoRequired, self).__init__(username=user.username)


class TwoFactorRequired(SentryAPIException):
    status_code = status.HTTP_401_UNAUTHORIZED
    code = "2fa-required"
    message = "Organization requires two-factor authentication to be enabled"


class ConflictError(APIException):
    status_code = status.HTTP_409_CONFLICT


class InvalidRepository(Exception):
    pass
