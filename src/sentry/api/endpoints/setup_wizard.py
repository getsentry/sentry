from __future__ import absolute_import
import logging

from rest_framework.response import Response

from sentry import ratelimits
from sentry.cache import default_cache
from sentry.api.base import Endpoint
from sentry.api.serializers import serialize
from django.utils.crypto import get_random_string

logger = logging.getLogger("sentry.api")
SETUP_WIZARD_CACHE_KEY = "setup-wizard-keys:v1:"
SETUP_WIZARD_CACHE_TIMEOUT = 600


class SetupWizard(Endpoint):
    permission_classes = ()

    def delete(self, request, wizard_hash=None):
        """
        This removes the cache content for a specific hash
        """
        if wizard_hash is not None:
            key = "%s%s" % (SETUP_WIZARD_CACHE_KEY, wizard_hash)
            default_cache.delete(key)
            return Response(status=200)

    def get(self, request, wizard_hash=None):
        """
        This tries to retrieve and return the cache content if possible
        otherwise creates new cache
        """
        if wizard_hash is not None:
            key = "%s%s" % (SETUP_WIZARD_CACHE_KEY, wizard_hash)
            wizard_data = default_cache.get(key)

            if wizard_data is None:
                return Response(status=404)
            elif wizard_data == "empty":
                # when we just created a clean cache
                return Response(status=400)

            return Response(serialize(wizard_data))
        else:
            # This creates a new available hash url for the project wizard
            rate_limited = ratelimits.is_limited(
                key="rl:setup-wizard:ip:%s" % request.META["REMOTE_ADDR"], limit=10
            )
            if rate_limited:
                logger.info("setup-wizard.rate-limit")
                return Response({"Too many wizard requests"}, status=403)
            wizard_hash = get_random_string(64, allowed_chars="abcdefghijklmnopqrstuvwxyz012345679")

            key = "%s%s" % (SETUP_WIZARD_CACHE_KEY, wizard_hash)
            default_cache.set(key, "empty", SETUP_WIZARD_CACHE_TIMEOUT)
            return Response(serialize({"hash": wizard_hash}))
