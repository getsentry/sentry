from collections.abc import Mapping
from typing import TypedDict

from sentry.hybridcloud.rpc import RpcModel


class RpcSentryAppOrganization(RpcModel):
    name: str
    slug: str


class RpcSentryAppRequest(RpcModel):
    date: str
    response_code: int
    webhook_url: str
    organization_id: int
    event_type: str
    error_id: str | None = None
    project_id: int | None = None
    request_body: str | None = None
    request_headers: Mapping[str, str] | None = None
    response_body: str | None = None


class SentryAppRequestFilterArgs(TypedDict, total=False):
    event: str
    errors_only: bool
