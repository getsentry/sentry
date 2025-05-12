from sentry import features
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.utils.performance_issues.base import DetectorType, PerformanceDetector


class SQLInjectionDetector(PerformanceDetector):
    __slots__ = "stored_problems"

    type = DetectorType.SQL_INJECTION
    settings_key = DetectorType.SQL_INJECTION

    def is_creation_allowed_for_organization(self, organization: Organization) -> bool:
        return features.has("organizations:sql-injection-detector", organization, actor=None)

    def is_creation_allowed_for_project(self, project: Project) -> bool:
        return self.settings["detection_enabled"]
