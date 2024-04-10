from typing import Literal, TypedDict

ModelLiterals = Literal["preview", "vertex", "openai"]
UseCaseLiterals = Literal["suggestedfix"]


class PreviewOptions(TypedDict):
    api_key: str
    default_model: str


class PreviewSettings(TypedDict):
    models: list[Literal["stub-1.0"]]
    options: PreviewOptions


class OpenAiOptions(TypedDict):
    api_key: str
    default_model: str


class OpenAiSettings(TypedDict):
    models: list[Literal["gpt-4-turbo-1.0"]]
    options: OpenAiOptions


class VertexOptions(TypedDict):
    url: str


class VertexSettings(TypedDict):
    models: list[Literal["stub-1.0"]]
    options: VertexOptions


class ProviderOptions(TypedDict):
    preview: PreviewSettings
    openai: OpenAiSettings
    vertex: VertexSettings


class UseCaseProviderOptions(TypedDict):
    model: str


class UseCaseOptionsValue(TypedDict):
    provider: ModelLiterals
    options: UseCaseProviderOptions


UseCaseOptions = dict[UseCaseLiterals, UseCaseOptionsValue]
