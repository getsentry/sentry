import logging
from enum import StrEnum
from typing import Any

import sentry_sdk
from django.apps.registry import Apps
from django.db import migrations, router, transaction
from django.db.backends.base.schema import BaseDatabaseSchemaEditor

from sentry.constants import ObjectStatus
from sentry.new_migrations.migrations import CheckedMigration
from sentry.rules.conditions.event_frequency import EventUniqueUserFrequencyConditionWithConditions
from sentry.rules.processing.processor import split_conditions_and_filters
from sentry.utils.query import RangeQuerySetWrapperWithProgressBarApprox
from sentry.workflow_engine.migration_helpers.issue_alert_conditions import (
    create_event_unique_user_frequency_condition_with_conditions,
    translate_to_data_condition,
)
from sentry.workflow_engine.migration_helpers.rule_action import (
    build_notification_actions_from_rule_data_actions,
)

logger = logging.getLogger(__name__)

SKIPPED_CONDITIONS = ["every_event"]


class SkipMigratingException(Exception):
    pass


# move enum here, cannot use the nested one from the model class
class DataConditionGroupType(StrEnum):
    # ANY will evaluate all conditions, and return true if any of those are met
    ANY = "any"

    # ANY_SHORT_CIRCUIT will stop evaluating conditions as soon as one is met
    ANY_SHORT_CIRCUIT = "any-short"

    # ALL will evaluate all conditions, and return true if all of those are met
    ALL = "all"

    # NONE will return true if none of the conditions are met, will return false immediately if any are met
    NONE = "none"


def migrate_issue_alerts(apps: Apps, schema_editor: BaseDatabaseSchemaEditor) -> None:
    Project = apps.get_model("sentry", "Project")
    Rule = apps.get_model("sentry", "Rule")
    RuleActivity = apps.get_model("sentry", "RuleActivity")
    RuleSnooze = apps.get_model("sentry", "RuleSnooze")
    AlertRuleDetector = apps.get_model("workflow_engine", "AlertRuleDetector")
    AlertRuleWorkflow = apps.get_model("workflow_engine", "AlertRuleWorkflow")
    DataConditionGroup = apps.get_model("workflow_engine", "DataConditionGroup")
    DataConditionGroupAction = apps.get_model("workflow_engine", "DataConditionGroupAction")
    Detector = apps.get_model("workflow_engine", "Detector")
    DetectorWorkflow = apps.get_model("workflow_engine", "DetectorWorkflow")
    Workflow = apps.get_model("workflow_engine", "Workflow")
    WorkflowDataConditionGroup = apps.get_model("workflow_engine", "WorkflowDataConditionGroup")

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
                    condition["id"] == EventUniqueUserFrequencyConditionWithConditions.id
                ):  # special case
                    dcg_conditions.append(
                        create_event_unique_user_frequency_condition_with_conditions(
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

        filtered_data_conditions = [
            dc for dc in dcg_conditions if dc.type not in SKIPPED_CONDITIONS
        ]

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
        no_conditions = len(data_conditions) == 0
        only_has_every_event_cond = (
            len(conditions) == 1
            and conditions[0]["id"] == "sentry.rules.conditions.every_event.EveryEventCondition"
        )

        if no_conditions and not only_has_every_event_cond:
            raise SkipMigratingException("No valid conditions, skipping migration")

        enabled = True
        rule_snooze = RuleSnooze.objects.filter(rule=rule, user_id=None).first()
        if rule_snooze and rule_snooze.until is None:
            enabled = False
        if rule.status == ObjectStatus.DISABLED:
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
        # workflow.update(date_added=rule.date_added) # this does not work in a migration context
        Workflow.objects.filter(id=workflow.id).update(date_added=rule.date_added)
        DetectorWorkflow.objects.create(detector=detector, workflow=workflow)
        AlertRuleWorkflow.objects.create(rule=rule, workflow=workflow)

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
        WorkflowDataConditionGroup.objects.create(workflow=workflow, condition_group=if_dcg)

        conditions_ids = [condition["id"] for condition in conditions]
        # skip migrating filters for special case
        if EventUniqueUserFrequencyConditionWithConditions.id not in conditions_ids:
            _bulk_create_data_conditions(rule=rule, conditions=filters, dcg=if_dcg)

        return if_dcg

    def _create_workflow_actions(if_dcg: Any, actions: list[dict[str, Any]]) -> None:
        notification_actions = build_notification_actions_from_rule_data_actions(
            actions, is_dry_run=False
        )
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
                            detector=error_detector, rule=rule
                        )
                        if not created:
                            raise SkipMigratingException("Rule already migrated")

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
        ("workflow_engine", "0033_workflow_name_256_char"),
    ]

    operations = [
        migrations.RunPython(
            migrate_issue_alerts,
            migrations.RunPython.noop,
            hints={"tables": ["sentry_rule"]},
        ),
    ]
