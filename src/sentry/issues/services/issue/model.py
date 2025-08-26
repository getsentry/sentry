from datetime import datetime

from sentry.hybridcloud.rpc import RpcModel


class RpcGroupShareMetadata(RpcModel):
    title: str
    message: str


class RpcExternalIssueGroupMetadata(RpcModel):
    type: str
    title: str
    title_url: str
    first_seen: datetime | None
    last_seen: datetime | None
    first_release: str | None
    first_release_url: str | None
    last_release: str | None
    last_release_url: str | None
    stats_24hr: str
    stats_14d: str
