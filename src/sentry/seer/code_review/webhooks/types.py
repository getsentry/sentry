from enum import StrEnum


class EventType(StrEnum):
    CHECK_RUN = "check_run"

    @classmethod
    def from_string(cls, value: str) -> "EventType":
        try:
            return cls(value)
        except ValueError:
            raise ValueError(f"Invalid event type: {value}")
