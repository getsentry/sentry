from __future__ import absolute_import

from django.core.urlresolvers import reverse
from rest_framework import status
from rest_framework.exceptions import APIException


class ResourceDoesNotExist(APIException):
    status_code = status.HTTP_404_NOT_FOUND


class ResourceMoved(APIException):
    status_code = status.HTTP_301_MOVED_PERMANENTLY


class SsoRequired(APIException):
    status_code = status.HTTP_401_UNAUTHORIZED

    def __init__(self, organization):
        detail = {
            'code': 'sso-required',
            'message': 'Must login via SSO',
            'extra': {
                'loginUrl': reverse('sentry-auth-organization', args=[organization.slug]),
            }
        }
        super(SsoRequired, self).__init__(detail=detail)


class SudoRequired(APIException):
    status_code = status.HTTP_401_UNAUTHORIZED

    def __init__(self, user):
        detail = {
            'code': 'sudo-required',
            "message": "Account verification required.",
            'extra': {
                "username": user.username,
            }
        }
        super(SudoRequired, self).__init__(detail=detail)


class TwoFactorRequired(APIException):
    status_code = status.HTTP_401_UNAUTHORIZED

    def __init__(self, organization):
        detail = {
            'code': '2fa-required',
            'message': 'Organization requires two-factor authentication to be enabled'
        }
        super(TwoFactorRequired, self).__init__(detail=detail)


class InvalidRepository(Exception):
    pass
