# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from pydantic import Field

from sentry.hybridcloud.rpc import RpcModel


class RpcServiceAccount(RpcModel):
    id: int = -1
    organization_id: int = -1
    name: str = ""
    scope_list: list[str] = Field(default_factory=list)
    is_active: bool = False
    # Only restricts access when the org doesn't have open membership. May briefly include a
    # deleted project until the tombstone cascade runs, so callers must still check the project.
    project_ids: list[int] = Field(default_factory=list)
