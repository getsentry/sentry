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


class SentryAppRequestFilterArgs(TypedDict, total=False):
    event: str
    errors_only: bool
