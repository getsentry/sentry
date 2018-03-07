from __future__ import absolute_import

import six
import uuid

from rest_framework.response import Response

from django.core.cache import cache as default_cache
from django.utils import timezone

from sentry.api.base import Endpoint
from sentry.api.serializers import serialize
from sentry.models import Relay

from smith import create_register_challenge, validate_register_response, \
    get_register_response_relay_id, PublicKey


def get_header_relay_id(request):
    try:
        return six.text_type(uuid.UUID(request.META['HTTP_X_SENTRY_RELAY_ID']))
    except (LookupError, ValueError, TypeError):
        pass


class RelayRegisterChallengeEndpoint(Endpoint):
    authentication_classes = ()
    permission_classes = ()

    def post(self, request):
        """
        Requests to Register a Relay
        ````````````````````````````

        Registers the relay with the sentry installation.  If a relay boots
        it will always attempt to invoke this endpoint.
        """

        sig = request.META.get('HTTP_X_SENTRY_RELAY_SIGNATURE')
        if not sig:
            return Response({
                'detail': 'Missing relay signature',
            }, status=400)

        challenge = create_register_challenge(request.body, sig)
        relay_id = six.text_type(challenge['relay_id'])
        if relay_id != get_header_relay_id(request):
            return Response({
                'detail': 'relay_id in payload did not match header',
            }, status=400)

        try:
            relay = Relay.objects.get(relay_id=relay_id)
        except Relay.DoesNotExist:
            pass
        else:
            if relay.public_key != six.text_type(challenge['public_key']):
                return Response({
                    'detail': 'Attempted to register agent with a different public key',
                }, status=400)

        default_cache.set('relay-auth:%s' % relay_id, {
            'token': challenge['token'],
            'public_key': six.text_type(challenge['public_key']),
        }, 60)
        return Response(serialize({
            'relay_id': six.text_type(challenge['relay_id']),
            'token': challenge['token'],
        }))


class RelayRegisterResponseEndpoint(Endpoint):
    authentication_classes = ()
    permission_classes = ()

    def post(self, request):
        """
        Registers a Relay
        `````````````````

        Registers the relay with the sentry installation.  If a relay boots
        it will always attempt to invoke this endpoint.
        """

        sig = request.META.get('HTTP_X_SENTRY_RELAY_SIGNATURE')
        if not sig:
            return Response({
                'detail': 'Missing relay signature',
            }, status=400)

        relay_id = six.text_type(get_register_response_relay_id(request.body))
        if relay_id != get_header_relay_id(request):
            return Response({
                'detail': 'relay_id in payload did not match header',
            }, status=400)

        params = default_cache.get('relay-auth:%s' % relay_id)
        if params is None:
            return Response({
                'detail': 'Challenge expired'
            }, status=401)

        key = PublicKey.parse(params['public_key'])
        data = validate_register_response(key, request.body, sig)
        if data['token'] != params['token']:
            return Response({
                'detail': 'Token mismatch'
            }, status=401)

        try:
            relay = Relay.objects.get(relay_id=relay_id)
        except Relay.DoesNotExist:
            relay = Relay.objects.create(
                relay_id=relay_id,
                public_key=params['public_key'],
            )
        else:
            if relay.public_key != params['public_key']:
                return Response({
                    'detail': 'Attempted to register agent with a different public key',
                }, status=400)
            relay.last_seen = timezone.now()
            relay.save()
        default_cache.delete('relay-auth:%s' % relay_id)

        return Response(serialize({
            'relay_id': relay.relay_id,
        }))
