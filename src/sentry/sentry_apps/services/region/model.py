# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from __future__ import annotations

from typing import Any

from pydantic.fields import Field

from sentry.hybridcloud.rpc import RpcModel
from sentry.sentry_apps.utils.errors import (
    SentryAppBaseError,
    SentryAppErrorType,
    SentryAppPublicErrorBody,
)


# XXX: Normally RPCs wouldn't return errors like this, but we need to surface these errors to Sentry
# Apps and by moving operation into these services, we'd lose the helpful errors without this.
class RpcSentryAppError(RpcModel):
    error_type: SentryAppErrorType = SentryAppErrorType.CLIENT
    status_code: int = 400
    message: str = ""
    public_dict: SentryAppPublicErrorBody | None = None
    webhook_context: dict[str, Any] = Field(default_factory=dict)

    @classmethod
    def from_exc(cls, exception: SentryAppBaseError) -> RpcSentryAppError:
        return RpcSentryAppError(
            error_type=exception.error_type,
            status_code=exception.status_code,
            message=exception.message,
            public_dict=exception.to_public_dict(),
            webhook_context=exception.webhook_context,
        )


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


class RpcPlatformExternalIssueResult(RpcModel):
    external_issue: RpcPlatformExternalIssue | None = None
    error: RpcSentryAppError | None = None


class RpcEmptyResult(RpcModel):
    success: bool = True
    error: RpcSentryAppError | None = None


class RpcServiceHookProject(RpcModel):
    id: int
    project_id: int


class RpcServiceHookProjectsResult(RpcModel):
    service_hook_projects: list[RpcServiceHookProject] = Field(default_factory=list)
    error: RpcSentryAppError | None = None


class RpcTimeSeriesPoint(RpcModel):
    time: int
    count: int


class RpcInteractionStatsResult(RpcModel):
    views: list[RpcTimeSeriesPoint] = Field(default_factory=list)
    component_interactions: dict[str, list[RpcTimeSeriesPoint]] = Field(default_factory=dict)
    error: RpcSentryAppError | None = None
