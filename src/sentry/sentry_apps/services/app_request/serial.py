from typing import Any

from sentry.sentry_apps.services.app_request.model import (
    RpcSentryAppRequest,
    RpcSentryAppRequestHeaders,
)


def serialize_rpc_sentry_app_request(request: dict[str, Any]) -> RpcSentryAppRequest:
    rpc_request_headers = None
    request_headers_data = request.get("request_headers")
    if request_headers_data:
        rpc_request_headers = RpcSentryAppRequestHeaders(
            content_type=request_headers_data.get("content_type"),
            request_id=request_headers_data.get("request_id"),
            sentry_hook_resource=request_headers_data.get("sentry_hook_resource"),
            sentry_hook_signature=request_headers_data.get("sentry_hook_signature"),
            sentry_hook_timestamp=request_headers_data.get("sentry_hook_timestamp"),
        )
    return RpcSentryAppRequest(
        date=request.get("date"),
        response_code=request.get("response_code"),
        webhook_url=request.get("webhook_url"),
        organization_id=request.get("organization_id"),
        event_type=request.get("event_type"),
        error_id=request.get("error_id"),
        project_id=request.get("project_id"),
        request_body=request.get("request_body"),
        request_headers=rpc_request_headers,
        response_body=request.get("response_body"),
    )
