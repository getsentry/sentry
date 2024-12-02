from sentry.sentry_apps.services.app import app_service
from sentry.sentry_apps.services.app_request.model import (
    RpcSentryAppRequest,
    SentryAppRequestFilterArgs,
)
from sentry.sentry_apps.services.app_request.serial import serialize_rpc_sentry_app_request
from sentry.sentry_apps.services.app_request.service import SentryAppRequestService
from sentry.utils.sentry_apps import SentryAppWebhookRequestsBuffer


class DatabaseBackedSentryAppRequestService(SentryAppRequestService):
    def get_buffer_requests_for_region(
        self,
        *,
        sentry_app_id: str,
        region_name: str,
        filter: SentryAppRequestFilterArgs | None = None,
    ) -> list[RpcSentryAppRequest] | None:
        sentry_app = app_service.get_sentry_app_by_id(id=sentry_app_id)
        if not sentry_app:
            return None
        buffer = SentryAppWebhookRequestsBuffer(sentry_app)

        event = filter.get("event", None) if filter else None
        errors_only = filter.get("errors_only", False) if filter else False

        return [
            serialize_rpc_sentry_app_request(req)
            for req in buffer.get_requests(event=event, errors_only=errors_only)
        ]
