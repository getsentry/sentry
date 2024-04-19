from typing import TypedDict


class ProviderConfig(TypedDict):
    options: dict[str, str]
    models: list[str]


class UseCaseConfig(TypedDict):
    provider: str
    options: dict[str, str]
