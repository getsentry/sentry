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
        self.reverse_lookup: dict[T, str] = {}

    def register(self, key: str):
        def inner(item: T) -> T:
            if key in self.registrations:
                raise AlreadyRegisteredError(
                    f"A registration already exists for {key}: {self.registrations[key]}"
                )

            if item in self.reverse_lookup:
                raise AlreadyRegisteredError(
                    f"A registration already exists for {item}: {self.reverse_lookup[item]}"
                )

            self.registrations[key] = item
            self.reverse_lookup[item] = key

            return item

        return inner

    def get(self, key: str) -> T:
        if key not in self.registrations:
            raise NoRegistrationExistsError(f"No registration exists for {key}")
        return self.registrations[key]

    def get_key(self, item: T) -> str:
        if item not in self.reverse_lookup:
            raise NoRegistrationExistsError(f"No registration exists for {item}")
        return self.reverse_lookup[item]
