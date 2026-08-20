from sentry.sentry_apps.services.app_request.model import RpcSentryAppRequest
from sentry.utils.sentry_apps.request_buffer import SentryAppRequest


def serialize_rpc_sentry_app_request(request: SentryAppRequest) -> RpcSentryAppRequest:
    return RpcSentryAppRequest.parse_obj(request)
