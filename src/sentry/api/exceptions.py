from __future__ import absolute_import

from django.core.urlresolvers import reverse
from rest_framework import status
from rest_framework.exceptions import APIException


class ResourceDoesNotExist(APIException):
    status_code = status.HTTP_404_NOT_FOUND


class SentryAPIException(APIException):
    code = ''
    message = ''

    def __init__(self, code=None, message=None, detail=None, **kwargs):
        if detail is None:
            detail = {
                'code': code or self.code,
                'message': message or self.message,
                'extra': kwargs,
            }

        super(SentryAPIException, self).__init__(detail=detail)


class ResourceMoved(SentryAPIException):
    status_code = status.HTTP_307_TEMPORARY_REDIRECT
    # code/message currently don't get used
    code = 'resource-moved'
    message = 'Resource has been moved'

    def __init__(self, new_url):
        super(ResourceMoved, self).__init__(
            url=new_url
        )


class SsoRequired(SentryAPIException):
    status_code = status.HTTP_401_UNAUTHORIZED
    code = 'sso-required'
    message = 'Must login via SSO'

    def __init__(self, organization):
        super(SsoRequired, self).__init__(
            loginUrl=reverse('sentry-auth-organization', args=[organization.slug])
        )


class SuperuserRequired(SentryAPIException):
    status_code = status.HTTP_403_FORBIDDEN
    code = 'superuser-required'
    message = 'You need to re-authenticate for superuser.'


class SudoRequired(SentryAPIException):
    status_code = status.HTTP_401_UNAUTHORIZED
    code = 'sudo-required'
    message = 'Account verification required.'

    def __init__(self, user):
        super(SudoRequired, self).__init__(username=user.username)


class TwoFactorRequired(APIException):
    status_code = status.HTTP_401_UNAUTHORIZED
    code = '2fa-required'
    message = 'Organization requires two-factor authentication to be enabled'


class InvalidRepository(Exception):
    pass
