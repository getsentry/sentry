from __future__ import absolute_import

from django.contrib.auth.models import AnonymousUser
from rest_framework.authentication import (BasicAuthentication, get_authorization_header)
from rest_framework.exceptions import AuthenticationFailed

from sentry.app import raven
from sentry.models import ApiKey, ApiToken


class QuietBasicAuthentication(BasicAuthentication):
    def authenticate_header(self, request):
        return 'xBasic realm="%s"' % self.www_authenticate_realm


class AgentAuthentication(QuietBasicAuthentication):
    def authenticate(self, request):
        agent_signature = request.META.get('HTTP_X_SENTRY_AGENT_SIGNATURE', b'')

        # TODO(hazat): read signature und check agent id
        if not agent_signature:
            raise AuthenticationFailed('Invalid agent signature')

        return self.authenticate_credentials(agent_signature, None)

    def authenticate_credentials(self, userid, password):
        if password:
            return None

        # TODO(hazat): read signature und check agent id
        # try:
        #     key = ApiKey.objects.get_from_cache(key=userid)
        # except ApiKey.DoesNotExist:
        #     raise AuthenticationFailed('API key is not valid')

        # if not key.is_active:
        #     raise AuthenticationFailed('Key is disabled')

        # raven.tags_context({
        #     'api_key': key.id,
        # })

        # TODO(hazat): return agent id
        return (AnonymousUser(), userid)


class ApiKeyAuthentication(QuietBasicAuthentication):
    def authenticate_credentials(self, userid, password):
        if password:
            return None

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
            token = ApiToken.objects.filter(
                token=token,
            ).select_related('user', 'application').get()
        except ApiToken.DoesNotExist:
            raise AuthenticationFailed('Invalid token')

        if token.is_expired():
            raise AuthenticationFailed('Token expired')

        if not token.user.is_active:
            raise AuthenticationFailed('User inactive or deleted')

        if token.application and not token.application.is_active:
            raise AuthenticationFailed('UserApplication inactive or deleted')

        raven.tags_context({
            'api_token': token.id,
        })

        return (token.user, token)
