from __future__ import annotations

from typing import Generic, TypeVar


class AlreadyRegisteredError(ValueError):
    pass


class NoRegistrationExistsError(ValueError):
    pass


T = TypeVar("T")


class Registry(Generic[T]):
    def __init__(self):
        self.registrations: dict[str, T] = {}

    def register(self, key: str):
        def inner(item: T) -> T:
            if key in self.registrations:
                raise AlreadyRegisteredError(
                    f"A registration already exists for {key}: {self.registrations[key]}"
                )
            self.registrations[key] = item
            return item

        return inner

    def get(self, key: str) -> T:
        if key not in self.registrations:
            raise NoRegistrationExistsError(f"No registration exists for {key}")
        return self.registrations[key]
