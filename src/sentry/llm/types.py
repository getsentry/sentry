from typing import Any, Literal, TypedDict

ModelLiterals = Literal["preview", "vertex", "openai"]
UseCaseLiterals = Literal["suggestedfix"]


class ProviderOptions(TypedDict):
    preview: dict[str, Any]
    openai: dict[str, Any]
    vertex: dict[str, Any]


class UseCaseProviderOptions(TypedDict):
    model: str


class UseCaseOptionsValue(TypedDict):
    provider: ModelLiterals
    options: UseCaseProviderOptions


UseCaseOptions = dict[UseCaseLiterals, UseCaseOptionsValue]
