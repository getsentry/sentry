from __future__ import absolute_import

from django.contrib.auth.models import AnonymousUser
from django.utils.crypto import constant_time_compare
from rest_framework.authentication import (BasicAuthentication, get_authorization_header)
from rest_framework.exceptions import AuthenticationFailed

from sentry.app import raven
from sentry.models import ApiApplication, ApiKey, ApiToken, Relay
from sentry.relay.utils import get_header_relay_id, get_header_relay_signature

import semaphore


class QuietBasicAuthentication(BasicAuthentication):
    def authenticate_header(self, request):
        return 'xBasic realm="%s"' % self.www_authenticate_realm


class RelayAuthentication(BasicAuthentication):
    def authenticate(self, request):
        relay_id = get_header_relay_id(request)
        relay_sig = get_header_relay_signature(request)
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
            data = relay.public_key_object.unpack(request.body, relay_sig,
                                                  max_age=60 * 5)
            request.relay = relay
            request.relay_request_data = data
        except semaphore.UnpackError:
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


class ClientIdSecretAuthentication(QuietBasicAuthentication):
    """
    Authenticates a Sentry Application using its Client ID and Secret

    This will be the method by which we identify which Sentry Application is
    making the request, for any requests not scoped to an installation.

    For example, the request to exchange a Grant Code for an Api Token.
    """

    def authenticate(self, request):
        if not request.json_body:
            raise AuthenticationFailed('Invalid request')

        client_id = request.json_body.get('client_id')
        client_secret = request.json_body.get('client_secret')

        invalid_pair_error = AuthenticationFailed('Invalid Client ID / Secret pair')

        if not client_id or not client_secret:
            raise invalid_pair_error

        try:
            application = ApiApplication.objects.get(client_id=client_id)
        except ApiApplication.DoesNotExist:
            raise invalid_pair_error

        if not constant_time_compare(application.client_secret, client_secret):
            raise invalid_pair_error

        try:
            return (application.sentry_app.proxy_user, None)
        except Exception:
            raise invalid_pair_error


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
