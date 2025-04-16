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
ActionData = dict[str, Any]


class WorkflowValidator(CamelSnakeSerializer):
    name = serializers.CharField(required=True, max_length=256)
    enabled = serializers.BooleanField(required=False, default=True)
    config = serializers.JSONField(required=False)
    triggers = BaseDataConditionGroupValidator(required=False)
    action_filters = serializers.ListField(required=False)

    # TODO - Need to improve the following fields (validate them in db)
    organization_id = serializers.IntegerField(required=True)
    environment_id = serializers.IntegerField(required=False)

    def _split_action_and_condition_group(
        self, action_filter: dict[str, Any]
    ) -> tuple[ActionData, DataConditionGroupData]:
        action = action_filter.get("action", None)

        if not action:
            raise serializers.ValidationError("An action is required in the actionFilter")

        condition_group_keys = action_filter.keys() - action.keys()
        condition_group = {k: action_filter[k] for k in condition_group_keys}

        return action, condition_group

    def validate_config(self, value):
        schema = Workflow.config_schema
        return validate_json_schema(value, schema)

    def validate_action_filters(self, value):
        for action_filter in value:
            action, condition_group = self._split_action_and_condition_group(action_filter)
            BaseDataConditionGroupValidator(data=condition_group).is_valid(raise_exception=True)
            BaseActionValidator(data=action).is_valid(raise_exception=True)

        return value

    def create(self, validated_value: dict[str, Any]) -> Workflow:
        condition_group_validator = BaseDataConditionGroupValidator()
        action_validator = BaseActionValidator()

        with transaction.atomic(router.db_for_write(Workflow)):
            # create triggers
            when_condition_group = condition_group_validator.create(validated_value["triggers"])

            workflow = Workflow.objects.create(
                name=validated_value["name"],
                enabled=validated_value["enabled"],
                config=validated_value["config"],
                organization_id=validated_value["organization_id"],
                environment_id=validated_value.get("environment_id"),
                when_condition_group=when_condition_group,
            )

            for action_filter in validated_value["action_filters"]:
                action, condition_group = self._split_action_and_condition_group(action_filter)
                new_condition_group = condition_group_validator.create(condition_group)
                new_action = action_validator.create(action)

                # Connect the aciton to the condition group
                DataConditionGroupAction.objects.create(
                    action=new_action,
                    condition_group=new_condition_group,
                )

                # Connect the condition group to the workflow
                WorkflowDataConditionGroup.objects.create(
                    condition_group=new_condition_group,
                    workflow=workflow,
                )

                # TODO - Use Context for organization
                create_audit_entry(
                    request=self.context["request"],
                    organization=validated_value["organization_id"],
                    target_object=workflow.id,
                    event=audit_log.get_event_id("WORKFLOW_ADD"),
                    data=workflow.get_audit_log_data(),
                )

            return workflow
