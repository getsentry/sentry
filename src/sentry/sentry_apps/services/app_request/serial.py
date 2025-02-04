from typing import Any

from sentry.sentry_apps.services.app_request.model import RpcSentryAppRequest


def serialize_rpc_sentry_app_request(request: dict[str, Any]) -> RpcSentryAppRequest:
    return RpcSentryAppRequest(
        date=request.get("date"),
        response_code=request.get("response_code"),
        webhook_url=request.get("webhook_url"),
        organization_id=request.get("organization_id"),
        event_type=request.get("event_type"),
        error_id=request.get("error_id"),
        project_id=request.get("project_id"),
        request_body=request.get("request_body"),
        request_headers=request.get("request_headers"),
        response_body=request.get("response_body"),
    )
