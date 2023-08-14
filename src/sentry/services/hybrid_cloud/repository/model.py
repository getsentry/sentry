# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from typing import Any, Dict, Optional

from sentry.services.hybrid_cloud import RpcModel


class RpcRepository(RpcModel):
    id: int
    organization_id: int
    name: str
    external_id: Optional[str]
    config: Dict[str, Any]
    integration_id: Optional[int]
    provider: Optional[str]
    status: int
    url: Optional[str]


class RpcCreateRepository(RpcModel):
    name: str
    external_id: Optional[str]
    config: Dict[str, Any]
    integration_id: int
    provider: str
    status: int
    url: str
