from dataclasses import dataclass

from sentry.sentry_apps.models.sentry_app import SentryApp
from sentry.sentry_apps.services.app_request import RpcSentryAppRequest, SentryAppRequestFilterArgs
from sentry.sentry_apps.services.app_request.serial import serialize_rpc_sentry_app_request
from sentry.sentry_apps.services.app_request.service import app_request_service
from sentry.types.region import find_all_region_names
from sentry.utils.sentry_apps import SentryAppWebhookRequestsBuffer


@dataclass
class BufferedRequest:
    id: int
    data: RpcSentryAppRequest

    def __hash__(self):
        return self.id


def get_buffer_requests_from_control(
    sentry_app: SentryApp, filter: SentryAppRequestFilterArgs
) -> list[RpcSentryAppRequest]:
    control_buffer = SentryAppWebhookRequestsBuffer(sentry_app)

    event = filter.get("event", None) if filter else None
    errors_only = filter.get("errors_only", False) if filter else False

    return [
        serialize_rpc_sentry_app_request(req)
        for req in control_buffer.get_requests(event=event, errors_only=errors_only)
    ]


def get_buffer_requests_from_regions(
    sentry_app_id: int, filter: SentryAppRequestFilterArgs
) -> list[RpcSentryAppRequest]:
    requests: list[RpcSentryAppRequest] = []
    for region_name in find_all_region_names():
        buffer_requests = app_request_service.get_buffer_requests_for_region(
            sentry_app_id=sentry_app_id,
            region_name=region_name,
            filter=filter,
        )
        if buffer_requests:
            requests.extend(buffer_requests)
    return requests
