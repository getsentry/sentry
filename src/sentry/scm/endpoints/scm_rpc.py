import sentry_sdk
from django.conf import settings
from django.http import HttpResponse, StreamingHttpResponse
from rest_framework.request import Request
from scm.rpc.server import RpcServer

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, internal_cell_silo_endpoint
from sentry.scm.private.helpers import (
    fetch_repository,
    fetch_service_provider,
    record_count_metric,
    report_error_to_sentry,
)


def make_server():
    return RpcServer(
        secrets=settings.SCM_RPC_SHARED_SECRET or [],
        fetch_repository=fetch_repository,
        fetch_provider=fetch_service_provider,
        record_count=record_count_metric,
        emit_error=report_error_to_sentry,
    )


@internal_cell_silo_endpoint
class ScmRpcServiceEndpoint(Endpoint):
    """
    RPC endpoint for SCM interactions. Authenticated with a shared secret.
    Copied from the normal rpc endpoint and modified for use with SCM.
    """

    publish_status = {"GET": ApiPublishStatus.PRIVATE, "POST": ApiPublishStatus.PRIVATE}
    owner = ApiOwner.CODING_WORKFLOWS
    authentication_classes = ()
    permission_classes = ()
    enforce_rate_limit = False

    @sentry_sdk.trace
    def get(self, request: Request) -> HttpResponse:
        resp = make_server().get(headers={k: v for k, v in request.headers.items()})
        return HttpResponse(content=resp.content, status=resp.status_code, headers=resp.headers)

    @sentry_sdk.trace
    def post(self, request: Request) -> StreamingHttpResponse:
        resp = make_server().post(request.body, headers={k: v for k, v in request.headers.items()})
        return StreamingHttpResponse(resp.content, status=resp.status_code, headers=resp.headers)
