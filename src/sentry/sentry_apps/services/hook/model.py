# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from collections.abc import Mapping
from typing import Any

from pydantic.fields import Field

from sentry.hybridcloud.rpc import RpcModel


class RpcServiceHook(RpcModel):
    id: int = -1
    guid: str | None = ""
    application_id: int | None = None
    installation_id: int | None = None
    project_id: int | None = None
    organization_id: int | None = None
    url: str = ""
    events: list[str] = Field(default_factory=list)
    status: int = 0

    def get_audit_log_data(self) -> Mapping[str, Any]:
        return {"url": self.url}
