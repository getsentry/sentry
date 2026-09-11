import logging
from decimal import Decimal, InvalidOperation
from typing import Any

from django.db import migrations
from django.db.backends.base.schema import BaseDatabaseSchemaEditor
from django.db.migrations.state import StateApps
from django.db.models import Q

from sentry.new_migrations.migrations import CheckedMigration
from sentry.utils.query import RangeQuerySetWrapperWithProgressBar

logger = logging.getLogger(__name__)

EVENT_SEEN_COUNT = "event_seen_count"
EVENT_CREATED_BY_DETECTOR = "event_created_by_detector"
ISSUE_RESOLUTION_CHANGE = "issue_resolution_change"
ISSUE_PRIORITY_DEESCALATING = "issue_priority_deescalating"
ISSUE_PRIORITY_EQUALS = "issue_priority_equals"
ISSUE_PRIORITY_GREATER_OR_EQUAL = "issue_priority_greater_or_equal"

CONDITION_TYPES = (
    EVENT_SEEN_COUNT,
    EVENT_CREATED_BY_DETECTOR,
    ISSUE_RESOLUTION_CHANGE,
    ISSUE_PRIORITY_DEESCALATING,
)
PRIORITY_CONDITION_TYPES = (
    ISSUE_PRIORITY_EQUALS,
    ISSUE_PRIORITY_GREATER_OR_EQUAL,
)
PRIORITY_VALUES = {25, 50, 75}
PRIORITY_NAMES = {"low", "medium", "high"}
RESOLVED = 1


def positive_integer(value: object) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value if value >= 1 else None
    if not isinstance(value, (float, str)):
        return None

    try:
        decimal = Decimal(str(value))
    except InvalidOperation:
        return None
    if not decimal.is_finite() or decimal < 1 or decimal != decimal.to_integral_value():
        return None
    return int(decimal)


def priority_integer(value: object) -> int | None:
    comparison = positive_integer(value)
    return comparison if comparison in PRIORITY_VALUES else None


def get_replacement(condition: Any, DataCondition: Any) -> int | None:
    comparison = condition.comparison
    if condition.type == EVENT_SEEN_COUNT:
        return RESOLVED if comparison is True else positive_integer(comparison)

    if condition.type == EVENT_CREATED_BY_DETECTOR:
        return positive_integer(comparison)

    if condition.type == ISSUE_RESOLUTION_CHANGE:
        if comparison is True or comparison == "resolved":
            return RESOLVED
        resolved = positive_integer(comparison)
        return resolved if resolved == RESOLVED else None

    if condition.type in PRIORITY_CONDITION_TYPES:
        return priority_integer(comparison)

    if condition.type == ISSUE_PRIORITY_DEESCALATING:
        if comparison is True:
            sibling_comparisons = DataCondition.objects.filter(
                condition_group_id=condition.condition_group_id,
                type=ISSUE_PRIORITY_GREATER_OR_EQUAL,
            ).values_list("comparison", flat=True)
            thresholds = {
                threshold
                for sibling in sibling_comparisons
                if (threshold := priority_integer(sibling)) is not None
            }
            return thresholds.pop() if len(thresholds) == 1 else None
        return priority_integer(comparison)

    return None


def cleanup_invalid_data_condition_comparisons(
    apps: StateApps, schema_editor: BaseDatabaseSchemaEditor
) -> None:
    DataCondition = apps.get_model("workflow_engine", "DataCondition")
    conditions = DataCondition.objects.filter(
        Q(type__in=CONDITION_TYPES)
        | Q(type__in=PRIORITY_CONDITION_TYPES) & ~Q(comparison__in=PRIORITY_NAMES)
    )

    for condition in RangeQuerySetWrapperWithProgressBar(conditions):
        old_comparison = condition.comparison
        replacement = get_replacement(condition, DataCondition)
        logging_extra = {
            "data_condition_id": condition.id,
            "data_condition_type": condition.type,
            "condition_group_id": condition.condition_group_id,
            "old_comparison": old_comparison,
        }

        if replacement is None:
            logger.warning(
                "Data condition comparison could not be safely converted and was left unchanged",
                extra=logging_extra,
            )
            continue

        if type(old_comparison) is int and old_comparison == replacement:
            continue

        condition.comparison = replacement
        condition.save(update_fields=["comparison"])
        logger.info(
            "Data condition comparison converted",
            extra={**logging_extra, "new_comparison": replacement},
        )


class Migration(CheckedMigration):
    is_post_deployment = True

    dependencies = [
        ("workflow_engine", "0119_add_index_for_all_project_detectors"),
    ]

    operations = [
        migrations.RunPython(
            cleanup_invalid_data_condition_comparisons,
            reverse_code=migrations.RunPython.noop,
            hints={"tables": ["workflow_engine_datacondition"]},
        ),
    ]
