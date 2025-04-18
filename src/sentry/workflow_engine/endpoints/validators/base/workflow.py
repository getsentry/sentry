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
    Action,
    DataConditionGroup,
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
    environment_id = serializers.IntegerField(required=False)
    triggers = BaseDataConditionGroupValidator(required=False)
    action_filters = serializers.ListField(required=False)

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

    def update_or_create_actions(self, actions_data):
        actions: list[Action] = []
        validator = BaseActionValidator(context=self.context)

        for action in actions_data:
            if action.get("id") is None:
                result = validator.create(action)
            else:
                action_instance = Action.objects.get(id=action["id"])
                result = validator.update(action_instance, action)

            actions.append(result)

        return actions

    def update_or_create_data_condition_group(
        self, condition_group_data: dict[str, Any]
    ) -> DataConditionGroup:
        validator = BaseDataConditionGroupValidator(context=self.context)
        actions: list = []

        if condition_group_data.get("actions") is not None:
            actions, condition_group_data = self._split_action_and_condition_group(
                condition_group_data
            )

        if condition_group_data.get("id") is None:
            result = validator.create(condition_group_data)
        else:
            condition_group = DataConditionGroup.objects.get(id=condition_group_data["id"])
            result = validator.update(condition_group, condition_group_data)

        if actions:
            self.update_or_create_actions(actions)

        return result

    def update(self, instance: Workflow, validated_data: dict[str, Any]) -> Workflow:
        with transaction.atomic(router.db_for_write(Workflow)):
            # Update the workflow triggers
            triggers = validated_data.pop("triggers", None)
            if triggers:
                # Ensure any conditions that were removed in the UI are removed from the DB
                if triggers.get("id") is not None:
                    condition_ids = [condition.get("id") for condition in triggers]
                    print(condition_ids)
                    # instance.when_condition_group.conditions.exclude(id__in=condition_ids).delete()

                self.update_or_create_data_condition_group(triggers)

            # Update the actions & dcg
            action_filters = validated_data.pop("action_filters", None)
            if action_filters:
                for action_filter in action_filters:
                    actions, condition_group = self._split_action_and_condition_group(action_filter)

                    if condition_group.get("id") is not None:
                        # TODO - remove any data condition groups not in the request
                        # TODO - figure out if this needs to happen with actions too
                        pass

                    self.update_or_create_data_condition_group(condition_group)
                    self.update_or_create_actions(actions)

            # Update the workflow
            instance.update(**validated_data)
            return instance

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
