from typing import int
from datetime import datetime

from sentry.hybridcloud.rpc import RpcModel


class RpcGroupShareMetadata(RpcModel):
    title: str
    message: str


class RpcExternalIssueGroupMetadata(RpcModel):
    title: str
    title_url: str
    link_date: datetime
