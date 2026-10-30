from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from sentry.workflow_engine.caches.mapping import CacheMapping

# Sliding TTL, refreshed whenever state is saved (any mark or hash change), so state
# only expires after three days without progress.
_STATE_TTL_SECONDS = 3 * 24 * 60 * 60
# Bump when the state shape changes; incompatible cached state is discarded on load.
CURRENT_STATE_VERSION = 1


class HealSchedulerState(BaseModel):
    version: int = CURRENT_STATE_VERSION
    # Most recently observed pipeline hash.
    head_hash: str | None = None
    # Non-NULL stale pipeline hash to the next group ID to schedule.
    stale: dict[str, int] = Field(default_factory=dict)
    # When stale hash discovery first succeeded for this state.
    discovered_at: datetime | None = None


_state_cache = CacheMapping[Literal["state"], HealSchedulerState](
    lambda key: key,
    namespace="issues-derived-heal",
    ttl_seconds=_STATE_TTL_SECONDS,
)


def load_state() -> HealSchedulerState | None:
    state = _state_cache.get("state")
    if not isinstance(state, HealSchedulerState) or state.version != CURRENT_STATE_VERSION:
        return None
    if state.discovered_at is None or state.discovered_at.tzinfo is None:
        return None
    return state


def save_state(state: HealSchedulerState) -> None:
    _state_cache.set("state", state)
