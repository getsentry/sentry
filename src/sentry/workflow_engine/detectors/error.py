from collections.abc import Callable
from typing import Any

from sentry.workflow_engine.models.detector import Detector


class ErrorDetector(Detector):
    project_options_config = {
        "groupingEnhancements": "sentry:grouping_enhancements",
        "fingerprintingRules": "sentry:fingerprinting_rules",
        "resolveAge": "sentry:resolve_age",
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
