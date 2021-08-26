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
            span_id = results.get("span_id")
            span_hash = results.get("hash")
            if span_id is None or span_hash is None:
                return None
            results[span_id] = span_hash

        return cls(grouping_config["id"], results)

    def write_to_event(self, event_data: Any) -> None:
        event_data["span_grouping_config"] = {"id": self.id}
        for span in event_data.get("spans", []):
            span_hash = self.results.get(span["span_id"])
            if span_hash:
                span["hash"] = span_hash
