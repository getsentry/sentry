# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from pydantic import Field

from sentry.hybridcloud.rpc import RpcModel


class RpcMassNotificationResult(RpcModel):
    success: bool
    notified_count: int
    error_str: str | None = None
    organization_ids: list[int] = Field(default_factory=list)
