from dataclasses import dataclass
from typing import Any, Dict, Optional


@dataclass(frozen=True)
class SpanGroupingResults:
    id: str
    results: Dict[str, str]

    @classmethod
    def from_event(cls, event_data: Any) -> Optional["SpanGroupingResults"]:
        grouping_config = event_data.get("span_grouping_config")
        if grouping_config is None or grouping_config.get("id") is None:
            return None

        results: Dict[str, str] = {}

        for span in event_data.get("spans", []):
            span_id = span.get("span_id")
            span_normalized = span.get("normalized")
            if span_id is None or span_normalized is None:
                # Every span should have a span id and normalized.
                # If not, return None to indicate that the grouping
                # results could not be constructed from the event.
                return None
            results[span_id] = span_normalized

        return cls(grouping_config["id"], results)

    def write_to_event(self, event_data: Any) -> None:
        for span in event_data.get("spans", []):
            span_normalized = self.results.get(span["span_id"])
            if span_normalized is not None:
                span["normalized"] = span_normalized
        event_data["span_grouping_config"] = {"id": self.id}
