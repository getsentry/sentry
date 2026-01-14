from sentry.integrations.services.github_copilot_identity.service import (
    GitHubCopilotIdentityService,
)


class DatabaseBackedGitHubCopilotIdentityService(GitHubCopilotIdentityService):
    def get_access_token_for_user(self, *, user_id: int) -> str | None:
        return None
