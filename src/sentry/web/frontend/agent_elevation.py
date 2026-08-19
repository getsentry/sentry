from __future__ import annotations

import secrets
from typing import Any

from django.http import HttpRequest, HttpResponse

import logging

from sentry.agent import elevation
from sentry.models.organization import Organization
from sentry.web.frontend.base import BaseView, control_silo_view

logger = logging.getLogger(__name__)


@control_silo_view
class AgentElevationView(BaseView):
    auth_required = True
    csrf_protect = True

    def _error(self, request: HttpRequest, message: str, status: int = 400) -> HttpResponse:
        return self.respond("sentry/oauth-error.html", {"error": message}, status=status)

    def get(self, request: HttpRequest, **kwargs: Any) -> HttpResponse:
        elevation_id = request.GET.get("elevation_id", "")
        if not elevation_id:
            return self._error(request, "Missing elevation_id parameter.")

        req = elevation.get_elevation_request(elevation_id)
        if req is None:
            return self._error(request, "This elevation request has expired or does not exist.", status=410)

        if req.status != "pending":
            return self._error(request, "This elevation request has already been processed.")

        if req.user_id != request.user.id:
            return self._error(request, "This elevation request belongs to a different user.", status=403)

        try:
            org = Organization.objects.get(id=req.organization_id)
        except Organization.DoesNotExist:
            return self._error(request, "Organization not found.", status=404)

        tx_id = secrets.token_urlsafe(32)
        session_key = f"elev:{tx_id}"
        request.session[session_key] = {
            "elevation_id": elevation_id,
            "uid": request.user.id,
        }
        request.session.modified = True

        return self.respond(
            "sentry/agent-elevate.html",
            {
                "tx_id": tx_id,
                "elevation_id": elevation_id,
                "org_name": org.name,
                "requested_scopes": req.requested_scopes,
            },
        )

    def post(self, request: HttpRequest, **kwargs: Any) -> HttpResponse:
        logger.info("elevation.post_received", extra={"op": request.POST.get("op")})
        tx_id = request.POST.get("tx_id", "")
        session_key = f"elev:{tx_id}"
        entry = request.session.get(session_key)

        if not entry or not isinstance(entry, dict):
            return self._error(request, "Invalid or expired session. Please try the link again.")

        if entry.get("uid") != request.user.id:
            return self._error(request, "Session user mismatch.", status=403)

        elevation_id = entry["elevation_id"]
        del request.session[session_key]
        request.session.modified = True

        req = elevation.get_elevation_request(elevation_id)
        if req is None:
            return self._error(request, "This elevation request has expired.", status=410)

        if req.status != "pending":
            return self._error(request, "This elevation request has already been processed.")

        op = request.POST.get("op")

        if op == "approve":
            elevation.approve_elevation_request(
                elevation_id,
                approved_scopes=req.requested_scopes,
            )
            return self.respond(
                "sentry/agent-elevate.html",
                {
                    "tx_id": "",
                    "elevation_id": elevation_id,
                    "org_name": "",
                    "requested_scopes": req.requested_scopes,
                    "approved": True,
                },
            )
        else:
            elevation.deny_elevation_request(elevation_id)
            return self.respond(
                "sentry/agent-elevate.html",
                {
                    "tx_id": "",
                    "elevation_id": elevation_id,
                    "org_name": "",
                    "requested_scopes": [],
                    "denied": True,
                },
            )
