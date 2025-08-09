from __future__ import annotations

from datetime import datetime

from sentry.hybridcloud.rpc import RpcModel


class RpcGroupShareMetadata(RpcModel):
    title: str
    message: str


class RpcLinkedIssueSummary(RpcModel):
    issue_link: str
    date_added: datetime
