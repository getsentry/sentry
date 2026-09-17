from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Literal

from pydantic import BaseModel, Field

from sentry.workflow_engine.caches.mapping import CacheMapping

_STATE_TTL_SECONDS = 3 * 24 * 60 * 60


class HealSchedulerState(BaseModel):
    version: Literal[1] = 1
    head_hash: str | None = None
    stale: dict[str, int] = Field(default_factory=dict)
    # Forces periodic from-zero sweeps to recover gaps below optimistic marks;
    # routine saves must not refresh it.
    discovered_at: datetime | None = None


_state_cache = CacheMapping[Literal["state"], HealSchedulerState](
    lambda key: key,
    namespace="issues-derived-heal-v1",
    ttl_seconds=_STATE_TTL_SECONDS,
)


def load_state() -> HealSchedulerState | None:
    state = _state_cache.get("state")
    if not isinstance(state, HealSchedulerState) or state.version != 1:
        return None
    if state.discovered_at is None or state.discovered_at.tzinfo is None:
        return None
    if datetime.now(timezone.utc) - state.discovered_at >= timedelta(seconds=_STATE_TTL_SECONDS):
        return None
    return state


def save_state(state: HealSchedulerState) -> None:
    _state_cache.set("state", state)
