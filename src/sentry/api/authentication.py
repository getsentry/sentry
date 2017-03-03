from __future__ import absolute_import

from django.contrib.auth.models import AnonymousUser
from django.utils.crypto import constant_time_compare
from rest_framework.authentication import (
    BasicAuthentication, get_authorization_header
)
from rest_framework.exceptions import AuthenticationFailed

from sentry import options
from sentry.app import raven
from sentry.models import ApiKey, ApiToken
from sentry.models.apikey import ROOT_KEY


class QuietBasicAuthentication(BasicAuthentication):
    def authenticate_header(self, request):
        return 'xBasic realm="%s"' % self.www_authenticate_realm


class ApiKeyAuthentication(QuietBasicAuthentication):
    def authenticate_credentials(self, userid, password):
        if password:
            return None

        root_api_key = options.get('system.root-api-key')
        if root_api_key:
            if constant_time_compare(root_api_key, userid):
                return (None, ROOT_KEY)

        try:
            key = ApiKey.objects.get_from_cache(key=userid)
        except ApiKey.DoesNotExist:
            raise AuthenticationFailed('API key is not valid')

        if not key.is_active:
            raise AuthenticationFailed('Key is disabled')

        raven.tags_context({
            'api_key': key.id,
        })

        return (AnonymousUser(), key)


class TokenAuthentication(QuietBasicAuthentication):
    def authenticate(self, request):
        auth = get_authorization_header(request).split()

        if not auth or auth[0].lower() != b'bearer':
            return None

        if len(auth) == 1:
            msg = 'Invalid token header. No credentials provided.'
            raise AuthenticationFailed(msg)
        elif len(auth) > 2:
            msg = 'Invalid token header. Token string should not contain spaces.'
            raise AuthenticationFailed(msg)

        return self.authenticate_credentials(auth[1])

    def authenticate_credentials(self, token):
        try:
            token = ApiToken.objects.get(token=token)
        except ApiToken.DoesNotExist:
            raise AuthenticationFailed('Invalid token')

        if not token.user.is_active:
            raise AuthenticationFailed('User inactive or deleted')

        raven.tags_context({
            'api_token': token.id,
        })

        return (token.user, token)
