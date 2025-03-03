import logging
from typing import Any

from sentry.constants import ObjectStatus
from sentry.grouping.grouptype import ErrorGroupType
from sentry.models.rule import Rule
from sentry.models.rulesnooze import RuleSnooze
from sentry.rules.conditions.event_frequency import EventUniqueUserFrequencyConditionWithConditions
from sentry.rules.processing.processor import split_conditions_and_filters
from sentry.workflow_engine.migration_helpers.issue_alert_conditions import (
    create_event_unique_user_frequency_condition_with_conditions,
    translate_to_data_condition,
)
from sentry.workflow_engine.migration_helpers.rule_action import (
    build_notification_actions_from_rule_data_actions,
)
from sentry.workflow_engine.models import (
    AlertRuleDetector,
    AlertRuleWorkflow,
    DataCondition,
    DataConditionGroup,
    DataConditionGroupAction,
    Detector,
    DetectorWorkflow,
    Workflow,
    WorkflowDataConditionGroup,
)
from sentry.workflow_engine.models.data_condition import (
    Condition,
    enforce_data_condition_json_schema,
)

logger = logging.getLogger(__name__)

SKIPPED_CONDITIONS = [Condition.EVERY_EVENT]


class IssueAlertMigrator:
    def __init__(
        self,
        rule: Rule,
        user_id: int | None = None,
        is_dry_run: bool | None = False,
        should_create_actions: bool | None = True,
    ):
        self.rule = rule
        self.user_id = user_id
        self.is_dry_run = is_dry_run
        self.should_create_actions = should_create_actions
        self.data = rule.data
        self.project = rule.project
        self.organization = self.project.organization

    def run(self) -> Workflow:
        error_detector = self._create_detector_lookup()
        conditions, filters = split_conditions_and_filters(self.data["conditions"])
        action_match = self.data.get("action_match") or Rule.DEFAULT_CONDITION_MATCH
        workflow = self._create_workflow_and_lookup(
            conditions=conditions,
            filters=filters,
            action_match=action_match,
            detector=error_detector,
        )
        filter_match = self.data.get("filter_match") or Rule.DEFAULT_FILTER_MATCH
        if_dcg = self._create_if_dcg(
            filter_match=filter_match,
            workflow=workflow,
            conditions=conditions,
            filters=filters,
        )
        if self.should_create_actions:
            self._create_workflow_actions(if_dcg=if_dcg, actions=self.data["actions"])

    def _create_detector_lookup(self) -> Detector:
        if self.is_dry_run:
            created = True
            error_detector = Detector.objects.filter(
                type=ErrorGroupType.slug, project=self.project
            ).first()
            if error_detector:
                created = not AlertRuleDetector.objects.filter(
                    detector=error_detector, rule=self.rule
                ).exists()
            else:
                error_detector = Detector(type=ErrorGroupType.slug, project=self.project)

        else:
            error_detector, _ = Detector.objects.get_or_create(
                type=ErrorGroupType.slug,
                project=self.project,
                defaults={"config": {}, "name": "Error Detector"},
            )
            _, created = AlertRuleDetector.objects.get_or_create(
                detector=error_detector, rule=self.rule
            )

        if not created:
            raise Exception("Issue alert already migrated")

        return error_detector

    def _bulk_create_data_conditions(
        self,
        conditions: list[dict[str, Any]],
        dcg: DataConditionGroup,
        filters: list[dict[str, Any]] | None = None,
    ):
        dcg_conditions: list[DataCondition] = []

        for condition in conditions:
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

        filtered_data_conditions = [
            dc for dc in dcg_conditions if dc.type not in SKIPPED_CONDITIONS
        ]

        if self.is_dry_run:
            for dc in filtered_data_conditions:
                dc.full_clean(
                    exclude=["condition_group"]
                )  # condition_group will be null, which is not allowed
                enforce_data_condition_json_schema(dc)
        else:
            DataCondition.objects.bulk_create(filtered_data_conditions)

    def _create_when_dcg(
        self,
        action_match: str,
    ):
        if action_match == "any":
            logic_type = DataConditionGroup.Type.ANY_SHORT_CIRCUIT.value
        else:
            logic_type = DataConditionGroup.Type(action_match)

        kwargs = {"organization": self.organization, "logic_type": logic_type}

        if self.is_dry_run:
            when_dcg = DataConditionGroup(**kwargs)
            when_dcg.full_clean()
        else:
            when_dcg = DataConditionGroup.objects.create(**kwargs)

        return when_dcg

    def _create_workflow_and_lookup(
        self,
        conditions: list[dict[str, Any]],
        filters: list[dict[str, Any]],
        action_match: str,
        detector: Detector,
    ) -> Workflow:
        when_dcg = self._create_when_dcg(action_match=action_match)
        self._bulk_create_data_conditions(conditions=conditions, filters=filters, dcg=when_dcg)

        enabled = True
        rule_snooze = RuleSnooze.objects.filter(rule=self.rule, user_id=None).first()
        if rule_snooze and rule_snooze.until is None:
            enabled = False
        if self.rule.status == ObjectStatus.DISABLED:
            enabled = False

        config = {"frequency": self.rule.data.get("frequency") or Workflow.DEFAULT_FREQUENCY}
        kwargs = {
            "organization": self.organization,
            "name": self.rule.label,
            "environment_id": self.rule.environment_id,
            "when_condition_group": when_dcg,
            "created_by_id": self.user_id,
            "owner_user_id": self.rule.owner_user_id,
            "owner_team": self.rule.owner_team,
            "config": config,
            "enabled": enabled,
        }

        if self.is_dry_run:
            workflow = Workflow(**kwargs)
            workflow.full_clean(exclude=["when_condition_group"])
            workflow.validate_config(workflow.config_schema)
        else:
            workflow = Workflow.objects.create(**kwargs)
            workflow.update(date_added=self.rule.date_added)
            DetectorWorkflow.objects.create(detector=detector, workflow=workflow)
            AlertRuleWorkflow.objects.create(rule=self.rule, workflow=workflow)

        return workflow

    def _create_if_dcg(
        self,
        filter_match: str,
        workflow: Workflow,
        conditions: list[dict[str, Any]],
        filters: list[dict[str, Any]],
    ) -> DataConditionGroup:
        if (
            filter_match == "any" or filter_match is None
        ):  # must create IF DCG even if it's empty, to attach actions
            logic_type = DataConditionGroup.Type.ANY_SHORT_CIRCUIT
        else:
            logic_type = DataConditionGroup.Type(filter_match)

        kwargs = {
            "organization": self.organization,
            "logic_type": logic_type,
        }

        if self.is_dry_run:
            if_dcg = DataConditionGroup(**kwargs)
            if_dcg.full_clean()
        else:
            if_dcg = DataConditionGroup.objects.create(**kwargs)
            WorkflowDataConditionGroup.objects.create(workflow=workflow, condition_group=if_dcg)

        conditions_ids = [condition["id"] for condition in conditions]
        # skip migrating filters for special case
        if EventUniqueUserFrequencyConditionWithConditions.id not in conditions_ids:
            self._bulk_create_data_conditions(conditions=filters, dcg=if_dcg)

        return if_dcg

    def _create_workflow_actions(
        self, if_dcg: DataConditionGroup, actions: list[dict[str, Any]]
    ) -> None:
        notification_actions = build_notification_actions_from_rule_data_actions(
            actions, is_dry_run=self.is_dry_run or False
        )
        dcg_actions = [
            DataConditionGroupAction(action=action, condition_group=if_dcg)
            for action in notification_actions
        ]
        if not self.is_dry_run:
            DataConditionGroupAction.objects.bulk_create(dcg_actions)
