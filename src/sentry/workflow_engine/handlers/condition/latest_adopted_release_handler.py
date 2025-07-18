from typing import Any

from sentry.models.activity import Activity
from sentry.models.environment import Environment
from sentry.models.release import follows_semver_versioning_scheme
from sentry.rules.age import AgeComparisonType, ModelAgeType
from sentry.rules.filters.latest_adopted_release_filter import (
    get_first_last_release_for_event,
    is_newer_release,
)
from sentry.search.utils import LatestReleaseOrders
from sentry.workflow_engine.handlers.condition.latest_release_handler import (
    get_latest_release_for_env,
)
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.registry import condition_handler_registry
from sentry.workflow_engine.types import DataConditionHandler, WorkflowEventData


@condition_handler_registry.register(Condition.LATEST_ADOPTED_RELEASE)
class LatestAdoptedReleaseConditionHandler(DataConditionHandler[WorkflowEventData]):
    group = DataConditionHandler.Group.ACTION_FILTER
    subgroup = DataConditionHandler.Subgroup.EVENT_ATTRIBUTES

    comparison_json_schema = {
        "type": "object",
        "properties": {
            "release_age_type": {"type": "string", "enum": [*ModelAgeType]},
            "age_comparison": {"type": "string", "enum": [*AgeComparisonType]},
            "environment": {"type": "string"},
        },
        "required": ["release_age_type", "age_comparison", "environment"],
        "additionalProperties": False,
    }

    @staticmethod
    def evaluate_value(event_data: WorkflowEventData, comparison: Any) -> bool:
        release_age_type = comparison["release_age_type"]
        age_comparison = comparison["age_comparison"]
        environment_name = comparison["environment"]

        event = event_data.event
        if isinstance(event, Activity):
            # If the event is an Activity, we cannot determine the latest adopted release
            return False

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

        release = get_first_last_release_for_event(event, release_age_type, order_type)
        if not release:
            return False

        if age_comparison == AgeComparisonType.NEWER:
            return is_newer_release(release, latest_project_release, order_type)
        elif age_comparison == AgeComparisonType.OLDER:
            return is_newer_release(latest_project_release, release, order_type)

        return False
