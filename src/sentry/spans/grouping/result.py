from dataclasses import dataclass
from typing import Any, Dict


@dataclass(frozen=True)
class SpanGroupingResults:
    id: str
    results: Dict[str, str]

    def write_to_event(self, event_data: Any) -> None:
        event_data["span_grouping_config"] = {"id": self.id}
        for span in event_data.get("spans", []):
            span_id = span["span_id"]
            span["hash"] = self.results[span_id]
