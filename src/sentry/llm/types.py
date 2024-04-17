from typing import TypedDict


class ProviderConfig(TypedDict):
    options: dict[str, str]
    models: list[str]


class UseCaseConfig(TypedDict):
    provider: str
    options: dict[str, str]


# class OpenAiProviderConfig(TypedDict):
#     options: OpenAiProviderConfigOptions
#     model: str


# class VertexProviderConfigOptions(TypedDict):
#     api_key: str


# class VertexProviderConfig(TypedDict):
#     options: VertexProviderConfigOptions
#     model: str


# class PreviewProviderConfigOptions(TypedDict):
#     api_key: str


# class PreviewProviderConfig(TypedDict):
#     options: PreviewProviderConfigOptions
#     model: str


# class ProviderConfig(TypedDict):
#     openai: NotRequired[OpenAiProviderConfig]
#     vertex: NotRequired[VertexProviderConfig]
#     preview: NotRequired[PreviewProviderConfig]
