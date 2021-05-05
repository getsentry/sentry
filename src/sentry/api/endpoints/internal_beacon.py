import logging

from django.conf import settings
from rest_framework.response import Response

from sentry import get_version, is_docker, options
from sentry.api.base import Endpoint
from sentry.http import safe_urlopen, safe_urlread
from sentry.tasks.beacon import BEACON_URL, create_broadcasts
from sentry.utils import json

logger = logging.getLogger("beacon")


class InternalBeaconEndpoint(Endpoint):
    permission_classes = ()

    def post(self, request):
        install_id = options.get("sentry:install-id")

        if not settings.SENTRY_BEACON:
            logger.info("beacon.skipped", extra={"install_id": install_id, "reason": "disabled"})
            return Response(status=204)

        if settings.DEBUG:
            logger.info("beacon.skipped", extra={"install_id": install_id, "reason": "debug"})
            return Response(status=204)

        anonymous = options.get("beacon.anonymous") is not False

        payload = {
            "type": "metric",
            "install_id": install_id,
            "version": get_version(),
            "docker": is_docker(),
            "data": request.data.get("data"),
            "anonymous": anonymous,
        }

        if not anonymous:
            payload["admin_email"] = options.get("system.admin-email")

        try:
            beacon_request = safe_urlopen(BEACON_URL, json=payload, timeout=5)
            response = safe_urlread(beacon_request)
        except Exception:
            logger.warning("beacon.failed", exc_info=True, extra={"install_id": install_id})
            return Response({"error": "Request failed"}, status=500)

        data = json.loads(response)

        if "notices" in data:
            create_broadcasts(data["notices"])

        return Response(status=204)
