from dataclasses import dataclass


@dataclass(frozen=True)
class DynamicField:
    type: str
    url: str | None
    choices: list[str] | None
