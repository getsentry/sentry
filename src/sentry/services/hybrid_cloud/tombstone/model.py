# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from sentry.services.hybrid_cloud import RpcModel


class RpcTombstone(RpcModel):
    table_name: str = ""
    identifier: int = -1
