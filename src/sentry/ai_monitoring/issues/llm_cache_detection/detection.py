"""Domain values for LLM prompt-cache usage detection."""

from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from enum import StrEnum

DETECTION_WINDOW_DAYS = 7


@dataclass(frozen=True)
class DetectionWindow:
    """Time range used by every query in one detection run."""

    start: datetime
    end: datetime

    @classmethod
    def ending_now(cls) -> DetectionWindow:
        end = datetime.now(UTC)
        return cls(start=end - timedelta(days=DETECTION_WINDOW_DAYS), end=end)


class AgentLabelSource(StrEnum):
    """Span attribute used to label a call site."""

    AGENT_NAME = "gen_ai.agent.name"
    OPERATION_NAME = "gen_ai.operation.name"


@dataclass(frozen=True)
class CallSiteStats:
    """Aggregates for one agent label, span name, and model.

    Call count is extrapolated. Sampled call count records stored spans behind
    token sums.
    """

    agent_label: str
    agent_label_source: AgentLabelSource
    span_name: str
    model: str
    call_count: int
    sampled_call_count: int
    sum_input_tokens: float
    sum_cache_read_tokens: float
    sum_cache_creation_tokens: float
    avg_input_tokens: float

    @property
    def group_key(self) -> tuple[str, str, str, str]:
        return (self.agent_label_source.value, self.agent_label, self.span_name, self.model)

    @property
    def hit_rate(self) -> float:
        if self.sum_input_tokens <= 0:
            return 0.0
        return self.sum_cache_read_tokens / self.sum_input_tokens

    @property
    def write_read_ratio(self) -> float | None:
        if self.sum_cache_read_tokens <= 0:
            return None
        return self.sum_cache_creation_tokens / self.sum_cache_read_tokens

    @property
    def uncached_tokens(self) -> float:
        """Input tokens neither read from nor written to cache."""
        return max(
            self.sum_input_tokens - self.sum_cache_read_tokens - self.sum_cache_creation_tokens,
            0.0,
        )

    @property
    def cache_exceeds_input(self) -> bool:
        """Whether cache token totals exceed input beyond rounding error."""
        cache_tokens = self.sum_cache_read_tokens + self.sum_cache_creation_tokens
        return cache_tokens > self.sum_input_tokens and not math.isclose(
            cache_tokens, self.sum_input_tokens
        )

    @property
    def unrecouped_cache_write_tokens(self) -> float:
        return max(self.sum_cache_creation_tokens - self.sum_cache_read_tokens, 0.0)

    @property
    def has_cache_activity(self) -> bool:
        return self.sum_cache_read_tokens > 0 or self.sum_cache_creation_tokens > 0
