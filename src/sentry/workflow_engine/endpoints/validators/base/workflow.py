from typing import Any

from django.db import router, transaction
from rest_framework import serializers

from sentry import audit_log
from sentry.api.serializers.rest_framework import CamelSnakeSerializer
from sentry.utils.audit import create_audit_entry
from sentry.workflow_engine.endpoints.validators.base import (
    BaseActionValidator,
    BaseDataConditionGroupValidator,
)
from sentry.workflow_engine.endpoints.validators.utils import validate_json_schema
from sentry.workflow_engine.models import (
    DataConditionGroupAction,
    Workflow,
    WorkflowDataConditionGroup,
)

DataConditionGroupData = dict[str, Any]
ActionData = list[dict[str, Any]]


class WorkflowValidator(CamelSnakeSerializer):
    name = serializers.CharField(required=True, max_length=256)
    enabled = serializers.BooleanField(required=False, default=True)
    config = serializers.JSONField(required=False)
    triggers = BaseDataConditionGroupValidator(required=False)
    action_filters = serializers.ListField(required=False)
    environment_id = serializers.IntegerField(required=False)

    def _split_action_and_condition_group(
        self, action_filter: dict[str, Any]
    ) -> tuple[ActionData, DataConditionGroupData]:
        try:
            actions = action_filter["actions"]
        except KeyError:
            raise serializers.ValidationError("Missing actions key in action filter")

        return actions, action_filter

    def validate_config(self, value):
        schema = Workflow.config_schema
        return validate_json_schema(value, schema)

    def validate_action_filters(self, value):
        for action_filter in value:
            actions, condition_group = self._split_action_and_condition_group(action_filter)
            BaseDataConditionGroupValidator(data=condition_group).is_valid(raise_exception=True)

            for action in actions:
                BaseActionValidator(data=action).is_valid(raise_exception=True)

        return value

    def update(self, instance: Workflow, validated_data: dict[str, Any]) -> Workflow:
        with transaction.atomic(router.db_for_write(Workflow)):
            # Update the workflow
            # update the triggers
            # update the actions & dcg
            pass
        pass

    def create(self, validated_value: dict[str, Any]) -> Workflow:
        condition_group_validator = BaseDataConditionGroupValidator(context=self.context)
        action_validator = BaseActionValidator(context=self.context)

        with transaction.atomic(router.db_for_write(Workflow)):
            when_condition_group = condition_group_validator.create(validated_value["triggers"])

            workflow = Workflow.objects.create(
                name=validated_value["name"],
                enabled=validated_value["enabled"],
                config=validated_value["config"],
                organization_id=self.context["organization"].id,
                environment_id=validated_value.get("environment_id"),
                when_condition_group=when_condition_group,
            )

            # TODO -- can we bulk create: actions, dcga's and the workflow dcg?
            # Create actions and action filters, then associate them to the workflow
            for action_filter in validated_value["action_filters"]:
                actions, condition_group = self._split_action_and_condition_group(action_filter)
                new_condition_group = condition_group_validator.create(condition_group)

                # Connect the condition group to the workflow
                WorkflowDataConditionGroup.objects.create(
                    condition_group=new_condition_group,
                    workflow=workflow,
                )

                for action in actions:
                    new_action = action_validator.create(action)
                    DataConditionGroupAction.objects.create(
                        action=new_action,
                        condition_group=new_condition_group,
                    )

            create_audit_entry(
                request=self.context["request"],
                organization=self.context["organization"],
                target_object=workflow.id,
                event=audit_log.get_event_id("WORKFLOW_ADD"),
                data=workflow.get_audit_log_data(),
            )

            return workflow
