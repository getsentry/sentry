import logging
from enum import StrEnum
from typing import Any

import sentry_sdk
from django.apps.registry import Apps
from django.db import migrations, router, transaction
from django.db.backends.base.schema import BaseDatabaseSchemaEditor

from sentry.new_migrations.migrations import CheckedMigration
from sentry.utils.query import RangeQuerySetWrapperWithProgressBarApprox

# TODO: remove these imports by copy-pasting the code into this file
from sentry.workflow_engine.migration_helpers.issue_alert_conditions import (
    translate_to_data_condition,
)
from sentry.workflow_engine.migration_helpers.rule_action import (
    build_notification_actions_from_rule_data_actions,
)

logger = logging.getLogger(__name__)

# COPY PASTES FOR RULE REGISTRY

SENTRY_RULES = {
    "sentry.rules.conditions.every_event.EveryEventCondition": "condition/event",
    "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition": "condition/event",
    "sentry.rules.conditions.regression_event.RegressionEventCondition": "condition/event",
    "sentry.rules.conditions.reappeared_event.ReappearedEventCondition": "condition/event",
    "sentry.rules.conditions.new_high_priority_issue.NewHighPriorityIssueCondition": "condition/event",
    "sentry.rules.conditions.existing_high_priority_issue.ExistingHighPriorityIssueCondition": "condition/event",
    "sentry.rules.conditions.tagged_event.TaggedEventCondition": "condition/event",
    "sentry.rules.conditions.event_frequency.EventFrequencyCondition": "condition/event",
    "sentry.rules.conditions.event_frequency.EventUniqueUserFrequencyCondition": "condition/event",
    "sentry.rules.conditions.event_frequency.EventUniqueUserFrequencyConditionWithConditions": "condition/event",
    "sentry.rules.conditions.event_frequency.EventFrequencyPercentCondition": "condition/event",
    "sentry.rules.conditions.event_attribute.EventAttributeCondition": "condition/event",
    "sentry.rules.conditions.level.LevelCondition": "condition/event",
    "sentry.rules.filters.age_comparison.AgeComparisonFilter": "filter/event",
    "sentry.rules.filters.issue_occurrences.IssueOccurrencesFilter": "filter/event",
    "sentry.rules.filters.assigned_to.AssignedToFilter": "filter/event",
    "sentry.rules.filters.latest_adopted_release_filter.LatestAdoptedReleaseFilter": "filter/event",
    "sentry.rules.filters.latest_release.LatestReleaseFilter": "filter/event",
    "sentry.rules.filters.issue_category.IssueCategoryFilter": "filter/event",
    # The following filters are duplicates of their respective conditions and are conditionally shown if the user has issue alert-filters
    "sentry.rules.filters.event_attribute.EventAttributeFilter": "filter/event",
    "sentry.rules.filters.tagged_event.TaggedEventFilter": "filter/event",
    "sentry.rules.filters.level.LevelFilter": "filter/event",
}


def split_conditions_and_filters(
    rule_condition_list: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    condition_list = []
    filter_list = []
    for rule_cond in rule_condition_list:
        if SENTRY_RULES.get(rule_cond["id"]) == "condition/event":
            condition_list.append(rule_cond)
        else:
            filter_list.append(rule_cond)

    return condition_list, filter_list


# COPY PASTES FOR DATACONDITIONGROUP
class DataConditionGroupType(StrEnum):
    # ANY will evaluate all conditions, and return true if any of those are met
    ANY = "any"

    # ANY_SHORT_CIRCUIT will stop evaluating conditions as soon as one is met
    ANY_SHORT_CIRCUIT = "any-short"

    # ALL will evaluate all conditions, and return true if all of those are met
    ALL = "all"

    # NONE will return true if none of the conditions are met, will return false immediately if any are met
    NONE = "none"


# COPY PASTES FOR DATACONDITION


class ComparisonType(StrEnum):
    COUNT = "count"
    PERCENT = "percent"


class MatchType(StrEnum):
    CONTAINS = "co"
    ENDS_WITH = "ew"
    EQUAL = "eq"
    GREATER_OR_EQUAL = "gte"
    GREATER = "gt"
    IS_SET = "is"
    IS_IN = "in"
    LESS_OR_EQUAL = "lte"
    LESS = "lt"
    NOT_CONTAINS = "nc"
    NOT_ENDS_WITH = "new"
    NOT_EQUAL = "ne"
    NOT_SET = "ns"
    NOT_STARTS_WITH = "nsw"
    NOT_IN = "nin"
    STARTS_WITH = "sw"


class Condition(StrEnum):
    # Base conditions - Most DETECTOR_TRIGGERS will use these
    EQUAL = "eq"
    GREATER_OR_EQUAL = "gte"
    GREATER = "gt"
    LESS_OR_EQUAL = "lte"
    LESS = "lt"
    NOT_EQUAL = "ne"

    # Anomaly detection
    ANOMALY_DETECTION = "anomaly_detection"

    # Issue conditions
    AGE_COMPARISON = "age_comparison"
    ASSIGNED_TO = "assigned_to"
    EVENT_ATTRIBUTE = "event_attribute"
    EVENT_CREATED_BY_DETECTOR = "event_created_by_detector"
    EVENT_SEEN_COUNT = "event_seen_count"
    EXISTING_HIGH_PRIORITY_ISSUE = "existing_high_priority_issue"
    FIRST_SEEN_EVENT = "first_seen_event"
    ISSUE_CATEGORY = "issue_category"
    ISSUE_OCCURRENCES = "issue_occurrences"
    LATEST_ADOPTED_RELEASE = "latest_adopted_release"
    LATEST_RELEASE = "latest_release"
    LEVEL = "level"
    NEW_HIGH_PRIORITY_ISSUE = "new_high_priority_issue"
    REGRESSION_EVENT = "regression_event"
    REAPPEARED_EVENT = "reappeared_event"
    TAGGED_EVENT = "tagged_event"
    ISSUE_PRIORITY_EQUALS = "issue_priority_equals"
    ISSUE_RESOLUTION_CHANGE = "issue_resolution_change"

    # Event frequency conditions
    EVENT_FREQUENCY_COUNT = "event_frequency_count"
    EVENT_FREQUENCY_PERCENT = "event_frequency_percent"
    EVENT_UNIQUE_USER_FREQUENCY_COUNT = "event_unique_user_frequency_count"
    EVENT_UNIQUE_USER_FREQUENCY_PERCENT = "event_unique_user_frequency_percent"
    PERCENT_SESSIONS_COUNT = "percent_sessions_count"
    PERCENT_SESSIONS_PERCENT = "percent_sessions_percent"

    # Migration Only
    EVERY_EVENT = "every_event"


def migrate_issue_alerts(apps: Apps, schema_editor: BaseDatabaseSchemaEditor) -> None:
    Project = apps.get_model("sentry", "Project")
    Rule = apps.get_model("sentry", "Rule")
    RuleActivity = apps.get_model("sentry", "RuleActivity")
    RuleSnooze = apps.get_model("sentry", "RuleSnooze")
    AlertRuleDetector = apps.get_model("workflow_engine", "AlertRuleDetector")
    AlertRuleWorkflow = apps.get_model("workflow_engine", "AlertRuleWorkflow")
    DataCondition = apps.get_model("workflow_engine", "DataCondition")
    DataConditionGroup = apps.get_model("workflow_engine", "DataConditionGroup")
    DataConditionGroupAction = apps.get_model("workflow_engine", "DataConditionGroupAction")
    Detector = apps.get_model("workflow_engine", "Detector")
    DetectorWorkflow = apps.get_model("workflow_engine", "DetectorWorkflow")
    Workflow = apps.get_model("workflow_engine", "Workflow")
    WorkflowDataConditionGroup = apps.get_model("workflow_engine", "WorkflowDataConditionGroup")

    def _create_event_unique_user_frequency_condition_with_conditions(
        data: dict[str, Any], dcg: Any, conditions: list[dict[str, Any]] | None = None
    ) -> Any:
        comparison_type = data.get("comparisonType", ComparisonType.COUNT)
        comparison_type = ComparisonType(comparison_type)
        value = max(int(data["value"]), 0)  # force to 0 if negative

        comparison = {
            "interval": data["interval"],
            "value": value,
        }

        if comparison_type == ComparisonType.COUNT:
            type = Condition.EVENT_UNIQUE_USER_FREQUENCY_COUNT
        else:
            type = Condition.EVENT_UNIQUE_USER_FREQUENCY_PERCENT
            comparison["comparison_interval"] = data["comparisonInterval"]

        comparison_filters = []

        if conditions:
            for condition in conditions:
                condition_id = condition["id"]
                comparison_filter: dict[str, Any] = {}

                match condition_id:
                    case "sentry.rules.filters.event_attribute.EventAttributeFilter":
                        comparison_filter["attribute"] = condition["attribute"]
                    case "sentry.rules.filters.tagged_event.TaggedEventFilter":
                        comparison_filter["key"] = condition["key"]
                    case _:
                        raise ValueError(f"Unsupported condition: {condition_id}")

                match = MatchType(condition["match"])
                comparison_filter["match"] = match

                if match not in {MatchType.IS_SET, MatchType.NOT_SET}:
                    comparison_filter["value"] = condition["value"]

                comparison_filters.append(comparison_filter)

        comparison["filters"] = comparison_filters

        return DataCondition(
            type=type,
            comparison=comparison,
            condition_result=True,
            condition_group=dcg,
        )

    def _bulk_create_data_conditions(
        rule: Any,
        conditions: list[dict[str, Any]],
        dcg: Any,
        filters: list[dict[str, Any]] | None = None,
    ) -> list[Any]:
        dcg_conditions: list[Any] = []

        for condition in conditions:
            try:
                if (
                    condition["id"]
                    == "sentry.rules.conditions.event_frequency.EventUniqueUserFrequencyConditionWithConditions"
                ):  # special case: this condition uses filters, so the migration needs to combine the filters into the condition
                    dcg_conditions.append(
                        _create_event_unique_user_frequency_condition_with_conditions(
                            dict(condition), dcg, filters
                        )
                    )
                else:
                    dcg_conditions.append(translate_to_data_condition(dict(condition), dcg=dcg))
            except Exception as e:
                logger.exception(
                    "workflow_engine.issue_alert_migration.error",
                    extra={"rule_id": rule.id, "error": str(e)},
                )

        filtered_data_conditions = [dc for dc in dcg_conditions if dc.type != Condition.EVERY_EVENT]

        data_conditions: list[Any] = []
        # try one by one, ignoring errors
        for dc in filtered_data_conditions:
            try:
                dc.save()
                data_conditions.append(dc)
            except Exception as e:
                sentry_sdk.capture_exception(e)
                logger.exception(
                    "workflow_engine.issue_alert_migration.error",
                    extra={"rule_id": rule.id, "error": str(e)},
                )
        return data_conditions

    def _create_when_dcg(
        action_match: str,
        organization: Any,
    ) -> Any:
        if action_match == "any":
            logic_type = DataConditionGroupType.ANY_SHORT_CIRCUIT.value
        else:
            logic_type = DataConditionGroupType(action_match)

        when_dcg = DataConditionGroup.objects.create(
            organization=organization, logic_type=logic_type
        )

        return when_dcg

    def _create_workflow_and_lookup(
        rule: Any,
        user_id: int | None,
        conditions: list[dict[str, Any]],
        filters: list[dict[str, Any]],
        action_match: str,
        detector: Any,
    ) -> Any:
        when_dcg = _create_when_dcg(
            organization=rule.project.organization, action_match=action_match
        )
        data_conditions = _bulk_create_data_conditions(
            rule=rule, conditions=conditions, filters=filters, dcg=when_dcg
        )

        # the only time the data_conditions list will be empty is if somebody only has EveryEventCondition in their conditions list.
        # if it's empty and this is not the case, we should not migrate
        no_conditions = len(conditions) == 0
        no_data_conditions = len(data_conditions) == 0
        only_has_every_event_cond = (
            len(conditions) == 1
            and conditions[0]["id"] == "sentry.rules.conditions.every_event.EveryEventCondition"
        )

        if no_data_conditions and no_conditions:
            # originally no conditions and we expect no data conditions
            pass
        elif no_data_conditions and not only_has_every_event_cond:
            raise Exception("No valid trigger conditions, skipping migration")

        enabled = True
        rule_snooze = RuleSnooze.objects.filter(rule=rule, user_id=None).first()
        if rule_snooze and rule_snooze.until is None:
            enabled = False
        if rule.status == 1:  # ObjectStatus.DISABLED
            enabled = False

        config = {"frequency": rule.data.get("frequency") or 30}  # Workflow.DEFAULT_FREQUENCY
        kwargs = {
            "organization": organization,
            "name": rule.label,
            "environment_id": rule.environment_id,
            "when_condition_group": when_dcg,
            "created_by_id": user_id,
            "owner_user_id": rule.owner_user_id,
            "owner_team": rule.owner_team,
            "config": config,
            "enabled": enabled,
        }

        workflow = Workflow.objects.create(**kwargs)
        workflow.date_added = rule.date_added
        workflow.save()
        Workflow.objects.filter(id=workflow.id).update(date_added=rule.date_added)
        DetectorWorkflow.objects.create(detector=detector, workflow=workflow)
        AlertRuleWorkflow.objects.create(rule_id=rule.id, workflow_id=workflow.id)

        return workflow

    def _create_if_dcg(
        rule: Any,
        organization: Any,
        filter_match: str,
        workflow: Any,
        conditions: list[dict[str, Any]],
        filters: list[dict[str, Any]],
    ) -> Any:
        if (
            filter_match == "any" or filter_match is None
        ):  # must create IF DCG even if it's empty, to attach actions
            logic_type = DataConditionGroupType.ANY_SHORT_CIRCUIT
        else:
            logic_type = DataConditionGroupType(filter_match)

        if_dcg = DataConditionGroup.objects.create(organization=organization, logic_type=logic_type)
        WorkflowDataConditionGroup.objects.create(workflow=workflow, condition_group_id=if_dcg.id)

        conditions_ids = [condition["id"] for condition in conditions]
        # skip migrating filters for special case
        if "EventUniqueUserFrequencyConditionWithConditions" not in conditions_ids:
            _bulk_create_data_conditions(rule=rule, conditions=filters, dcg=if_dcg)

        return if_dcg

    def _create_workflow_actions(if_dcg: Any, actions: list[dict[str, Any]]) -> None:
        notification_actions = build_notification_actions_from_rule_data_actions(actions)
        dcg_actions = [
            DataConditionGroupAction(action_id=action.id, condition_group_id=if_dcg.id)
            for action in notification_actions
        ]
        DataConditionGroupAction.objects.bulk_create(dcg_actions)

    # EXECUTION STARTS HERE
    for project in RangeQuerySetWrapperWithProgressBarApprox(Project.objects.all()):
        organization = project.organization
        error_detector, _ = Detector.objects.get_or_create(
            type="error",
            project=project,
            defaults={"config": {}, "name": "Error Detector"},
        )

        with transaction.atomic(router.db_for_write(Rule)):
            rules = Rule.objects.select_for_update().filter(project=project)

            for rule in RangeQuerySetWrapperWithProgressBarApprox(rules):
                try:
                    with transaction.atomic(router.db_for_write(Workflow)):
                        # make sure rule is not already migrated
                        _, created = AlertRuleDetector.objects.get_or_create(
                            detector_id=error_detector.id, rule_id=rule.id
                        )
                        if not created:
                            raise Exception("Rule already migrated")

                        data = rule.data
                        user_id = None
                        created_activity = RuleActivity.objects.filter(
                            rule=rule, type=1  # created
                        ).first()
                        if created_activity:
                            user_id = getattr(created_activity, "user_id")

                        conditions, filters = split_conditions_and_filters(data["conditions"])
                        action_match = data.get("action_match") or "all"
                        workflow = _create_workflow_and_lookup(
                            rule=rule,
                            user_id=int(user_id) if user_id else None,
                            conditions=conditions,
                            filters=filters,
                            action_match=action_match,
                            detector=error_detector,
                        )
                        filter_match = data.get("filter_match") or "all"
                        if_dcg = _create_if_dcg(
                            rule=rule,
                            organization=rule.project.organization,
                            filter_match=filter_match,
                            workflow=workflow,
                            conditions=conditions,
                            filters=filters,
                        )
                        _create_workflow_actions(if_dcg=if_dcg, actions=data["actions"])
                except Exception as e:
                    logger.exception(
                        "Error migrating issue alert", extra={"rule_id": rule.id, "error": str(e)}
                    )
                    sentry_sdk.capture_exception(e)


class Migration(CheckedMigration):
    # This flag is used to mark that a migration shouldn't be automatically run in production.
    # This should only be used for operations where it's safe to run the migration after your
    # code has deployed. So this should not be used for most operations that alter the schema
    # of a table.
    # Here are some things that make sense to mark as post deployment:
    # - Large data migrations. Typically we want these to be run manually so that they can be
    #   monitored and not block the deploy for a long period of time while they run.
    # - Adding indexes to large tables. Since this can take a long time, we'd generally prefer to
    #   run this outside deployments so that we don't block them. Note that while adding an index
    #   is a schema change, it's completely safe to run the operation after the code has deployed.
    # Once deployed, run these manually via: https://develop.sentry.dev/database-migrations/#migration-deployment

    is_post_deployment = True

    dependencies = [
        ("workflow_engine", "0046_drop_metric_alert_fire_detectors"),
    ]

    operations = [
        migrations.RunPython(
            migrate_issue_alerts,
            migrations.RunPython.noop,
            hints={"tables": ["sentry_rule"]},
        ),
    ]
