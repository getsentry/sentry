from __future__ import annotations

import logging

from django.utils.crypto import get_random_string
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import ratelimits
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, control_silo_endpoint
from sentry.api.serializers import serialize
from sentry.cache import default_cache
from sentry.utils.demo_mode import is_demo_user

logger = logging.getLogger("sentry.api")
SETUP_WIZARD_CACHE_KEY = "setup-wizard-keys:v1:"
SETUP_WIZARD_CACHE_TIMEOUT = 600


@control_silo_endpoint
class SetupWizard(Endpoint):
    owner = ApiOwner.WEB_FRONTEND_SDKS
    publish_status = {
        "DELETE": ApiPublishStatus.EXPERIMENTAL,
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    permission_classes = ()

    def delete(self, request: Request, wizard_hash=None) -> Response | None:
        """
        This removes the cache content for a specific hash
        """
        if wizard_hash is not None:
            key = f"{SETUP_WIZARD_CACHE_KEY}{wizard_hash}"
            default_cache.delete(key)
            return Response(status=200)
        return None

    def get(self, request: Request, wizard_hash=None) -> Response:
        """
        This tries to retrieve and return the cache content if possible
        otherwise creates new cache
        """
        if is_demo_user(request.user):
            return Response(status=403)

        if wizard_hash is not None:
            key = f"{SETUP_WIZARD_CACHE_KEY}{wizard_hash}"
            wizard_data = default_cache.get(key)

            if wizard_data is None:
                return Response(status=404)
            elif wizard_data == "empty":
                # when we just created a clean cache
                return Response(status=400)

            return Response(serialize(wizard_data))
        else:
            # This creates a new available hash url for the project wizard
            rate_limited = ratelimits.backend.is_limited(
                key="rl:setup-wizard:ip:%s" % request.META["REMOTE_ADDR"], limit=10
            )
            if rate_limited:
                logger.info("setup-wizard.rate-limit")
                return Response({"Too many wizard requests"}, status=403)
            wizard_hash = get_random_string(64, allowed_chars="abcdefghijklmnopqrstuvwxyz012345679")

            key = f"{SETUP_WIZARD_CACHE_KEY}{wizard_hash}"
            default_cache.set(key, "empty", SETUP_WIZARD_CACHE_TIMEOUT)
            return Response(serialize({"hash": wizard_hash}))
