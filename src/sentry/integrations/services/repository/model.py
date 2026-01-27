# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from typing import Any

from pydantic import Field

from sentry.hybridcloud.rpc import RpcModel


class RpcRepository(RpcModel):
    id: int
    organization_id: int
    name: str
    external_id: str | None
    config: dict[str, Any] = Field(repr=False)
    integration_id: int | None
    provider: str | None
    status: int
    url: str | None


class RpcCreateRepository(RpcModel):
    name: str
    external_id: str | None
    config: dict[str, Any] = Field(repr=False)
    integration_id: int
    provider: str
    status: int
    url: str
