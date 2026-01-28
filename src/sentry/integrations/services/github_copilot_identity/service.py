# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

import abc

from django.conf import settings

from sentry.hybridcloud.rpc.service import RpcService, rpc_method
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


class _DefaultGitHubCopilotIdentityService(GitHubCopilotIdentityService):
    def get_access_token_for_user(self, *, user_id: int) -> str | None:
        return None


github_copilot_identity_service = GitHubCopilotIdentityService.create_delegation()
