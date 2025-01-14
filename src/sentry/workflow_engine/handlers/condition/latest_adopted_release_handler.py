from typing import Any

from sentry.models.environment import Environment
from sentry.models.release import follows_semver_versioning_scheme
from sentry.rules.age import AgeComparisonType
from sentry.rules.filters.latest_adopted_release_filter import (
    get_first_last_release_for_env,
    is_newer_release,
)
from sentry.search.utils import LatestReleaseOrders
from sentry.workflow_engine.handlers.condition.latest_release_handler import (
    get_latest_release_for_env,
)
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.registry import condition_handler_registry
from sentry.workflow_engine.types import DataConditionHandler, WorkflowJob


@condition_handler_registry.register(Condition.LATEST_ADOPTED_RELEASE)
class LatestAdoptedReleaseConditionHandler(DataConditionHandler[WorkflowJob]):
    @staticmethod
    def evaluate_value(job: WorkflowJob, comparison: Any) -> bool:
        release_age_type = comparison["release_age_type"]
        age_comparison = comparison["age_comparison"]
        environment_name = comparison["environment"]

        event = job["event"]

        if follows_semver_versioning_scheme(event.organization.id, event.project.id):
            order_type = LatestReleaseOrders.SEMVER
        else:
            order_type = LatestReleaseOrders.DATE

        try:
            environment = Environment.get_for_organization_id(
                event.project.organization_id, environment_name
            )
        except Environment.DoesNotExist:
            return False

        latest_project_release = get_latest_release_for_env(environment, event)
        if not latest_project_release:
            return False

        release = get_first_last_release_for_env(event, release_age_type, order_type)
        if not release:
            return False

        if age_comparison == AgeComparisonType.NEWER:
            return is_newer_release(release, latest_project_release, order_type)
        elif age_comparison == AgeComparisonType.OLDER:
            return is_newer_release(latest_project_release, release, order_type)

        return False
