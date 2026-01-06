# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

import abc

from sentry.hybridcloud.rpc.service import RpcService, rpc_method
from sentry.silo.base import SiloMode


class GitHubCopilotIdentityService(RpcService):
    key = "github_copilot_identity"
    local_mode = SiloMode.CONTROL

    @classmethod
    def get_local_implementation(cls) -> RpcService:
        try:
            from getsentry.integrations.github_copilot.service import (
                DatabaseBackedGitHubCopilotIdentityService,
            )

            return DatabaseBackedGitHubCopilotIdentityService()
        except ImportError:
            return StubGitHubCopilotIdentityService()

    @rpc_method
    @abc.abstractmethod
    def get_access_token_for_user(self, *, user_id: int) -> str | None:
        pass


class StubGitHubCopilotIdentityService(GitHubCopilotIdentityService):
    def get_access_token_for_user(self, *, user_id: int) -> str | None:
        return None


github_copilot_identity_service = GitHubCopilotIdentityService.create_delegation()
