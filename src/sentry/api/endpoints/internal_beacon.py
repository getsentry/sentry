import logging

from django.conf import settings
from rest_framework.response import Response

from sentry import get_version, is_docker, options
from sentry.api.base import Endpoint
from sentry.http import safe_urlopen
from sentry.tasks.beacon import BEACON_URL

logger = logging.getLogger("beacon")


class InternalBeaconEndpoint(Endpoint):
    permission_classes = ()

    def post(self, request):
        error = None
        install_id = options.get("sentry:install-id")

        if not settings.SENTRY_BEACON:
            logger.info(
                "beacon_metric.skipped", extra={"install_id": install_id, "reason": "disabled"}
            )
            return Response(status=204)

        if settings.DEBUG:
            logger.info(
                "beacon_metric.skipped", extra={"install_id": install_id, "reason": "debug"}
            )
            return Response(status=204)

        anonymous = options.get("beacon.anonymous") is not False

        payload = {
            "type": "metric",
            "install_id": install_id,
            "version": get_version(),
            "docker": is_docker(),
            "anonymous": anonymous,
        }

        if not anonymous:
            payload["admin_email"] = options.get("system.admin-email")

        # Because this is used by the frontend, we want our frontend calls to be batched
        # in order to reduce the number requests
        data = request.data.get("data")
        payload_data = [data] if data is not None else request.data.get("batch_data", [])

        for payload_data_item in payload_data:
            try:
                safe_urlopen(BEACON_URL, json={**payload, "data": payload_data_item}, timeout=5)
            except Exception:
                logger.warning(
                    "beacon_metric.failed", exc_info=True, extra={"install_id": install_id}
                )
                error = "Request failed"

        return Response({"error": "Request failed"}, status=500) if error else Response(status=204)
