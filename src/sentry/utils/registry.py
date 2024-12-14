from __future__ import annotations

from typing import Generic, TypeVar


class AlreadyRegisteredError(ValueError):
    pass


class NoRegistrationExistsError(ValueError):
    pass


T = TypeVar("T")


class Registry(Generic[T]):
    """
    A simple generic registry that allows for registering and retrieving items by key. Reverse lookup by value is enabled by default.
    If you have duplicate values, you may want to disable reverse lookup.
    """

    def __init__(self, enable_reverse_lookup=True):
        self.registrations: dict[str, T] = {}
        self.reverse_lookup: dict[T, str] = {}
        self.enable_reverse_lookup = enable_reverse_lookup

    def register(self, key: str):
        def inner(item: T) -> T:
            if key in self.registrations:
                raise AlreadyRegisteredError(
                    f"A registration already exists for {key}: {self.registrations[key]}"
                )

            if self.enable_reverse_lookup:
                if item in self.reverse_lookup:
                    raise AlreadyRegisteredError(
                        f"A registration already exists for {item}: {self.reverse_lookup[item]}"
                    )
                self.reverse_lookup[item] = key

            self.registrations[key] = item

            return item

        return inner

    def get(self, key: str) -> T:
        if key not in self.registrations:
            raise NoRegistrationExistsError(f"No registration exists for {key}")
        return self.registrations[key]

    def get_key(self, item: T) -> str:
        if not self.enable_reverse_lookup:
            raise NotImplementedError("Reverse lookup is not enabled")
        if item not in self.reverse_lookup:
            raise NoRegistrationExistsError(f"No registration exists for {item}")
        return self.reverse_lookup[item]
