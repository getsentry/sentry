from collections.abc import Callable
from typing import Any

from sentry.backup.scopes import RelocationScope
from sentry.db.models.base import region_silo_model
from sentry.workflow_engine.models.detector import Detector


@region_silo_model
class ErrorDetector(Detector):
    __relocation_scope__ = RelocationScope.Organization

    project_options_config = {
        "fingerprinting_rules": "sentry:fingerprinting_rules",
        "resolve_age": "sentry:resolve_age",
    }

    class Meta:
        proxy = True

    @property
    def CONFIG_SCHEMA(self) -> dict[str, Any]:
        # TODO(cathy): add new features in here
        return {}

    def get_option(
        self, key: str, default: Any | None = None, validate: Callable[[object], bool] | None = None
    ) -> Any:
        if not self.project:
            raise ValueError("Detector must have a project to get options")

        return self.project.get_option(key, default=default, validate=validate)
