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

        # check the spans in the transaction
        for span in event_data.get("spans", []):
            span_id = span.get("span_id")
            span_hash = span.get("hash")
            if span_id is None or span_hash is None:
                # Every span should have a span id and hash.
                # If not, return None to indicate that the grouping
                # results could not be constructed from the event.
                return None
            results[span_id] = span_hash

        # check the transaction root span
        trace_context = event_data["contexts"]["trace"]
        span_id = trace_context.get("span_id")
        span_hash = trace_context.get("hash")
        if span_id is None or span_hash is None:
            # Every span should have a span id and hash.
            # If not, return None to indicate that the grouping
            # results could not be constructed from the event.
            return None
        results[span_id] = span_hash

        return cls(grouping_config["id"], results)

    def write_to_event(self, event_data: Any) -> None:
        # write the hashes of the spans in the transaction
        for span in event_data.get("spans", []):
            span_hash = self.results.get(span["span_id"])
            if span_hash is not None:
                span["hash"] = span_hash

        # write the hash of the transaction root spans
        trace_context = event_data["contexts"]["trace"]
        span_hash = self.results.get(trace_context["span_id"])
        if span_hash is not None:
            trace_context["hash"] = span_hash

        event_data["span_grouping_config"] = {"id": self.id}
