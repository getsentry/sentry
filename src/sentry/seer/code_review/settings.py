from sentry.models.repository import Repository
from sentry.models.repositorysettings import CodeReviewTrigger, RepositorySettings


class CodeReviewSettings:
    def __init__(
        self,
        enabled: bool,
        triggers: list[CodeReviewTrigger],
    ):
        self.enabled = enabled
        self.triggers = triggers

    def is_trigger_enabled(self, trigger: CodeReviewTrigger) -> bool:
        """Check if a specific trigger is enabled."""
        return trigger in self.triggers


def get_code_review_settings(repo: Repository) -> CodeReviewSettings | None:
    try:
        settings = RepositorySettings.objects.get(repository=repo)
        triggers = [CodeReviewTrigger(t) for t in settings.code_review_triggers]
        return CodeReviewSettings(
            enabled=settings.enabled_code_review,
            triggers=triggers,
        )
    except RepositorySettings.DoesNotExist:
        return None
