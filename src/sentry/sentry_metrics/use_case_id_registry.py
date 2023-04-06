from __future__ import annotations

from typing import Any, Iterator, Mapping, Set

from sentry.sentry_metrics.configuration import UseCaseKey

_HARDCODED_USE_CASES = {"PERFORMANCE": "performance", "RELEASE_HEALTH": "release-health"}

_REGISTERED_USE_CASES: dict[str, str] = {}


class _UseCaseID(type):
    def __getattr__(self, attr: str) -> UseCaseID:
        if attr not in _HARDCODED_USE_CASES and attr not in _REGISTERED_USE_CASES:
            raise AttributeError(attr)

        return UseCaseID(attr.lower())

    def __iter__(self) -> Iterator[UseCaseID]:
        return iter(
            UseCaseID(value)
            for value in {
                **_HARDCODED_USE_CASES,
                **_REGISTERED_USE_CASES,
            }.values()
        )


class UseCaseID(metaclass=_UseCaseID):
    def __init__(self, value: str):
        if (
            value not in _HARDCODED_USE_CASES.values()
            and value not in _REGISTERED_USE_CASES.values()
        ):
            raise ValueError("Passed use case has not been registered")

        self.value = value

    def __hash__(self) -> int:
        return hash(self.value)

    def __eq__(self, other: Any) -> bool:
        return isinstance(other, UseCaseID) and other.value == self.value

    def __repr__(self) -> str:
        return f"UseCaseID.{self.value.upper()}"


def register_use_case(key: str) -> UseCaseID:
    _REGISTERED_USE_CASES[key.upper()] = key.lower()
    return UseCaseID(key)


METRIC_PATH_MAPPING: Mapping[UseCaseKey, Set[UseCaseID]] = {
    UseCaseKey.RELEASE_HEALTH: {UseCaseID.RELEASE_HEALTH},
    UseCaseKey.PERFORMANCE: {UseCaseID.PERFORMANCE},
}
