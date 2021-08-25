from dataclasses import dataclass
from typing import Any, Dict, Optional, Sequence

from sentry.spans.grouping.result import SpanGroupingResults
from sentry.spans.grouping.strategy.base import SpanGroupingStrategy


@dataclass(frozen=True)
class SpanGroupingConfig:
    id: str
    strategy: SpanGroupingStrategy

    def execute_strategy(self, event_data: Any) -> SpanGroupingResults:
        spans = event_data.get("spans", [])
        results = self.strategy.execute(spans)
        return SpanGroupingResults(self.id, results)


CONFIGURATIONS: Dict[str, SpanGroupingStrategy] = {}


def register_configuration(id: str, strategies: Optional[Sequence[Any]] = None) -> None:
    if id in CONFIGURATIONS:
        # TODO raise an exception for duplicate config ids
        pass

    strategy = SpanGroupingStrategy(id, [] if strategies is None else strategies)
    CONFIGURATIONS[id] = SpanGroupingConfig(id, strategy)


register_configuration("builtin:2021-08-25", strategies=None)
