from typing import TypedDict

class _ParseUserAgentResult(TypedDict):
    family: str
    major: str | None
    minor: str | None
    patch: str | None

class _ParseOsResult(TypedDict):
    family: str
    major: str | None
    minor: str | None
    patch: str | None
    patch_minor: str | None

class _ParseDeviceResult(TypedDict):
    family: str
    brand: str | None
    model: str | None

class _ParseResult(TypedDict):
    user_agent: _ParseUserAgentResult
    os: _ParseOsResult
    device: _ParseDeviceResult
    string: str

def Parse(user_agent_string: str) -> _ParseResult: ...
