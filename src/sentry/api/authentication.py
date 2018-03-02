from __future__ import absolute_import

from django.contrib.auth.models import AnonymousUser
from rest_framework.authentication import (BasicAuthentication, get_authorization_header)
from rest_framework.exceptions import AuthenticationFailed

from sentry.app import raven
from sentry.models import ApiKey, ApiToken, Relay

import smith


class QuietBasicAuthentication(BasicAuthentication):
    def authenticate_header(self, request):
        return 'xBasic realm="%s"' % self.www_authenticate_realm


class RelayAuthentication(QuietBasicAuthentication):
    def authenticate(self, request):
        relay_id = request.META.get('HTTP_X_SENTRY_RELAY_ID', '')
        relay_sig = request.META.get('HTTP_X_SENTRY_RELAY_SIGNATURE', '')
        if not relay_id:
            raise AuthenticationFailed('Invalid relay ID')
        if not relay_sig:
            raise AuthenticationFailed('Missing relay signature')
        return self.authenticate_credentials(relay_id, relay_sig, request)

    def authenticate_credentials(self, relay_id, relay_sig, request):
        raven.tags_context({
            'relay_id': relay_id,
        })

        try:
            relay = Relay.objects.get(relay_id=relay_id)
        except Relay.DoesNotExist:
            raise AuthenticationFailed('Unknown relay')

        try:
            data = relay.public_key_object.verify(request.body, relay_sig)
            request.relay = relay
            request.relay_request_data = data
        except smith.UnpackError:
            raise AuthenticationFailed('Invalid relay signature')

        # TODO(mitsuhiko): can we return the relay here?  would be nice if we
        # could find some common interface for it
        return (AnonymousUser(), None)


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
