# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from typing import Any, TypedDict

from sentry.hybridcloud.rpc import RpcModel


class RpcGitHubCopilotIdentity(RpcModel):
    id: int
    user_id: int
    github_id: str
    data: dict[str, Any]
    date_added: str | None = None


class GitHubCopilotIdentityFilterArgs(TypedDict, total=False):
    id: int
    user_id: int
    github_id: str
