# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from typing import Any

from pydantic.fields import Field

from sentry.hybridcloud.rpc import RpcModel


class RpcSentryAppError(RpcModel):
    message: str
    webhook_context: dict[str, Any]
    status_code: int | None = None


class RpcSelectRequesterResult(RpcModel):
    choices: list[list[str]] = Field(default_factory=list)
    default_value: str | None = None
    error: RpcSentryAppError | None = None


class RpcPlatformExternalIssue(RpcModel):
    id: str
    issue_id: str
    service_type: str
    display_name: str
    web_url: str


class RpcIssueLinkResult(RpcModel):
    external_issue: RpcPlatformExternalIssue | None = None
    error: RpcSentryAppError | None = None
