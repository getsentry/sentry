from typing_extensions import TypedDict

from sentry.hybridcloud.rpc import RpcModel


class RpcSentryAppOrganization(RpcModel):
    name: str
    slug: str


class RpcSentryAppRequestHeaders(RpcModel):
    content_type: str
    request_id: str
    sentry_hook_resource: str
    sentry_hook_signature: str
    sentry_hook_timestamp: str


class RpcSentryAppRequest(RpcModel):
    date: str
    response_code: int
    webhook_url: str
    organization_id: int
    event_type: str
    error_id: str | None = None
    project_id: int | None = None
    request_body: str | None = None
    request_headers: RpcSentryAppRequestHeaders | None = None
    response_body: str | None = None


class SentryAppRequestFilterArgs(TypedDict, total=False):
    event: str
    errors_only: bool
