from __future__ import absolute_import
import logging

from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from sentry import ratelimits
from django.core.cache import cache
from sentry.api.base import Endpoint
from sentry.api.serializers import serialize
from django.utils.crypto import get_random_string

logger = logging.getLogger('sentry.api')


class SetupWizard(Endpoint):
    permission_classes = ()

    def delete(self, request, wizard_hash=None):
        if wizard_hash is not None:
            key = 'setup-wizard-keys:v1:%s' % wizard_hash
            cache.set(key, True, 7200)
            return Response(status=200)

    def get(self, request, wizard_hash=None):
        if wizard_hash is not None:
            key = 'setup-wizard-keys:v1:%s' % wizard_hash
            wizard_data = cache.get(key)
            # If wizard_data is true, it's still not filled from the
            # users requests
            if wizard_data is not None and wizard_data is not 0:
                # We reach this when the wizard pulled the data
                if wizard_data is 1:
                    return Response(status=404)
                return Response(serialize(wizard_data))

            return Response(status=400)
        else:
            """
            This creates a new available hash url for the project wizard
            """
            rate_limited = ratelimits.is_limited(
                key='rl:setup-wizard',
                limit=10,
            )
            if rate_limited:
                logger.info('setup-wizard.rate-limit')
                return Response(
                    {
                        'Too wizard requests',
                    }, status=403
                )
            wizard_hash = get_random_string(
                64, allowed_chars='abcdefghijklmnopqrstuvwxyz0123456790')

            # TODO(hazat): extract into global hash
            key = 'setup-wizard-keys:v1:%s' % wizard_hash
            cache.set(key, False, 7200)
            return Response(serialize({'hash': wizard_hash}))


class SetupWizardSecured(Endpoint):
    permission_classes = (IsAuthenticated, )

    def post(self, request, wizard_hash):
        key = 'setup-wizard-keys:v1:%s' % wizard_hash
        cache.set(key, request.DATA, 7200)
        return Response(serialize({'hash': wizard_hash}))
