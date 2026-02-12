# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

import abc

from django.conf import settings

from sentry.hybridcloud.rpc.service import RpcService, rpc_method
from sentry.integrations.services.github_copilot_identity.model import (
    GitHubCopilotIdentityFilterArgs,
    RpcGitHubCopilotIdentity,
)
from sentry.silo.base import SiloMode
from sentry.utils.imports import import_string


class GitHubCopilotIdentityService(RpcService):
    key = "github_copilot_identity"
    local_mode = SiloMode.CONTROL

    @classmethod
    def get_local_implementation(cls) -> RpcService:
        class_path = getattr(settings, "GITHUB_COPILOT_IDENTITY_SERVICE", None)
        if class_path is None:
            return _DefaultGitHubCopilotIdentityService()
        impl_class = import_string(class_path)
        return impl_class()

    @rpc_method
    @abc.abstractmethod
    def get_access_token_for_user(self, *, user_id: int) -> str | None:
        pass

    @rpc_method
    def get_one_or_none(
        self, *, filter: GitHubCopilotIdentityFilterArgs
    ) -> RpcGitHubCopilotIdentity | None:
        """
        Returns a single GitHub Copilot identity matching the filter criteria, or None.
        """
        return None

    @rpc_method
    def delete(self, *, identity_id: int, user_id: int) -> bool:
        """
        Delete a GitHub Copilot identity by ID, scoped to the user.
        Returns True if deleted, False if not found or not owned by user.
        """
        return False


class _DefaultGitHubCopilotIdentityService(GitHubCopilotIdentityService):
    def get_access_token_for_user(self, *, user_id: int) -> str | None:
        return None

    def get_one_or_none(
        self, *, filter: GitHubCopilotIdentityFilterArgs
    ) -> RpcGitHubCopilotIdentity | None:
        return None

    def delete(self, *, identity_id: int, user_id: int) -> bool:
        return False


github_copilot_identity_service = GitHubCopilotIdentityService.create_delegation()
