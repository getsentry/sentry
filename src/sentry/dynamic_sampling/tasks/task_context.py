import time
from dataclasses import dataclass
from typing import Any, Dict, Optional


@dataclass
class TaskContext:
    name: str
    num_seconds: float
    context_data: Optional[Dict[str, Any]] = None

    def __post_init__(self):
        # always override
        self.expiration_time = time.monotonic() + self.num_seconds

    def set_current_context(self, function_id: str, execution_time: float, data: Any):
        if self.context_data is None:
            self.context_data = {}
        self.context_data[function_id] = {
            "executionTime": execution_time,
            "data": data,
        }

    def get_current_context(
        self, function_id: str, default: Optional[Dict[str, Any]] = None
    ) -> Any:
        if self.context_data is None:
            return default
        return self.context_data.get(function_id, default)
