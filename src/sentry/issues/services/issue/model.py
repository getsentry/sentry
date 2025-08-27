from datetime import datetime

from sentry.hybridcloud.rpc import RpcModel


class RpcGroupShareMetadata(RpcModel):
    title: str
    message: str


class RpcExternalIssueGroupMetadata(RpcModel):
    title_url: str
    link_date: datetime
