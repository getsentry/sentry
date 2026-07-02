"""Type-only registration marker for seer RPC handlers.

Each entry in `seer_method_registry`, `public_org_seer_method_registry`, and
`public_project_seer_method_registry` must wrap its handler in `seer_rpc(...)`.
The wrap is a runtime identity — no behavior change — but it gives the custom
mypy plugin (`tools.mypy_helpers.plugin.SentryMypyPlugin`) a hook to verify
the handler's declared return type contains no `Any`.

**Why**: the seer-side codegen reads each registered method's return
annotation, builds a JSON-schema manifest, and emits `Literal[method] →
ReturnType` overloads on `RpcClient.call`. An `Any` return at this layer
collapses the typed contract for that method on the consumer side — the
seer-side `result = rpc_client.call("foo", ...)` loses its specific return
type and degrades to `Any`. The structural
`dict[str, Callable[..., BaseModel | None]]` annotation on the registries
already rejects `dict` / `dict[str, Any]` / generic `Callable` returns, but
`Any` is bidirectionally compatible with everything by design, so it slips
past structural checks. The `seer_rpc()` marker + plugin hook close that hole.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import TypeVar

from pydantic import BaseModel

SeerRpcMethod = Callable[..., BaseModel | None]
_RpcF = TypeVar("_RpcF", bound=SeerRpcMethod)


def seer_rpc(fn: _RpcF) -> _RpcF:
    """Marker the mypy plugin checks for `Any`-free return types; runtime
    identity. See module docstring for the codegen-driven rationale."""
    return fn
