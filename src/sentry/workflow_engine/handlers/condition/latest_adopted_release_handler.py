from typing import Any

from sentry.models.activity import Activity
from sentry.models.environment import Environment
from sentry.models.release import Release, follows_semver_versioning_scheme
from sentry.rules.age import AgeComparisonType, ModelAgeType
from sentry.rules.filters.latest_adopted_release_filter import (
    get_first_last_release_for_event,
    is_newer_release,
)
from sentry.search.utils import LatestReleaseOrders
from sentry.workflow_engine.handlers.condition.latest_release_handler import (
    get_latest_adopted_release_for_env,
)
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.registry import condition_handler_registry
from sentry.workflow_engine.types import DataConditionHandler, WorkflowEventData
from sentry.workflow_engine.utils import log_context

logger = log_context.get_logger(__name__)


@condition_handler_registry.register(Condition.LATEST_ADOPTED_RELEASE)
class LatestAdoptedReleaseConditionHandler(DataConditionHandler[WorkflowEventData]):
    group = DataConditionHandler.Group.ACTION_FILTER
    subgroup = DataConditionHandler.Subgroup.EVENT_ATTRIBUTES
    label_template = "The {oldest_or_newest} release associated with the event's issue is {older_or_newer} than the latest adopted release in {environment}"

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

        environment: Environment | None = None
        latest_project_release: Release | None = None
        release: Release | None = None
        order_type: LatestReleaseOrders | None = None

        def log_result(result: bool) -> bool:
            logger.debug(
                "workflow_engine.handlers.latest_adopted_release_handler",
                extra={
                    "configured_environment": environment_name,
                    "environment": environment.name if environment else None,
                    "latest_project_release": (
                        latest_project_release.version if latest_project_release else None
                    ),
                    "event_release": release.version if release else None,
                    "release_age_type": release_age_type,
                    "order_type": order_type.name if order_type else None,
                    "age_comparison": age_comparison,
                    "evaluation_result": result,
                },
            )
            return result

        event = event_data.event
        if isinstance(event, Activity):
            # If the event is an Activity, we cannot determine the latest adopted release
            return log_result(False)

        if follows_semver_versioning_scheme(event.organization.id, event.project.id):
            order_type = LatestReleaseOrders.SEMVER
        else:
            order_type = LatestReleaseOrders.DATE

        try:
            environment = Environment.get_for_organization_id(
                event.project.organization_id, environment_name
            )
        except Environment.DoesNotExist:
            return log_result(False)

        latest_project_release = get_latest_adopted_release_for_env(environment, event)
        if not latest_project_release:
            return log_result(False)

        release = get_first_last_release_for_event(event, release_age_type, order_type)
        if not release:
            return log_result(False)

        if age_comparison == AgeComparisonType.NEWER:
            return log_result(is_newer_release(release, latest_project_release, order_type))
        elif age_comparison == AgeComparisonType.OLDER:
            return log_result(is_newer_release(latest_project_release, release, order_type))

        return log_result(False)
