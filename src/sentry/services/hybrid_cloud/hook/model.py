# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from typing import Any, List, Mapping, Optional

from pydantic.fields import Field

from sentry.services.hybrid_cloud import RpcModel


class RpcServiceHook(RpcModel):
    id: int = -1
    guid: str = ""
    application_id: int = -1
    installation_id: Optional[int] = None
    project_id: Optional[int] = None
    organization_id: Optional[int] = None
    url: str = ""
    events: List[str] = Field(default_factory=list)
    status: int = 0

    def get_audit_log_data(self) -> Mapping[str, Any]:
        return {"url": self.url}
