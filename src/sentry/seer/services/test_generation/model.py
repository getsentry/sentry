# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.
# from typing import Any, Dict, Optional
from sentry.hybridcloud.rpc import RpcModel


class CreateUnitTestResponse(RpcModel):
    error_detail: str | None = None

    @property
    def success(self):
        return self.error_detail is None
