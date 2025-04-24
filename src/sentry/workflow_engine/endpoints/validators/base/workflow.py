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
    id = serializers.CharField(required=False)
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

    def validate_config(self, value) -> bool:
        schema = Workflow.config_schema
        return validate_json_schema(value, schema)

    def validate_action_filters(self, value: ActionData) -> ActionData:
        for action_filter in value:
            actions, condition_group = self._split_action_and_condition_group(action_filter)
            BaseDataConditionGroupValidator(data=condition_group).is_valid(raise_exception=True)

            for action in actions:
                BaseActionValidator(data=action).is_valid(raise_exception=True)

        return value

    def update_or_create_actions(
        self,
        actions_data: ActionData,
        condition_group: DataConditionGroup,
    ) -> None:
        validator = BaseActionValidator(context=self.context)

        action_ids = {int(action["id"]) for action in actions_data if action.get("id") is not None}
        saved_action_ids = set(
            condition_group.dataconditiongroupaction_set.values_list("action__id", flat=True)
        )

        has_action_removal = action_ids != saved_action_ids
        if has_action_removal:
            condition_group.dataconditiongroupaction_set.exclude(action__id__in=action_ids).delete()

        for action in actions_data:
            if action.get("id") is None:
                validator.create(action)
            else:
                action_instance = Action.objects.get(id=action["id"])
                validator.update(action_instance, action)

    def update_or_create_data_condition_group(
        self,
        condition_group_data: dict[str, Any],
        instance: DataConditionGroup | None = None,
    ) -> DataConditionGroup:
        validator = BaseDataConditionGroupValidator(context=self.context)

        condition_group_id = condition_group_data.get("id")
        if instance and condition_group_id and condition_group_id != str(instance.id):
            raise serializers.ValidationError(
                f"Invalid Condition Group ID {condition_group_data.get('id')}"
            )

        actions = condition_group_data.pop("actions", None)

        if condition_group_id is None:
            condition_group = validator.create(condition_group_data)
        else:
            stored_condition_group = DataConditionGroup.objects.get(id=condition_group_data["id"])
            condition_group = validator.update(stored_condition_group, condition_group_data)

        if actions is not None:
            self.update_or_create_actions(actions, condition_group)

        return condition_group

    def update_action_filters(
        self,
        action_filters: list[dict[str, Any]],
    ) -> list[DataConditionGroup]:
        instance = self.context["workflow"]
        filters: list[DataConditionGroup] = []

        if not action_filters:
            # If the action filter is set to an empty list, delete all the actions
            instance.workflowdataconditiongroup_set.all().delete()

        action_filter_ids = {int(af["id"]) for af in action_filters if af.get("id") is not None}
        condition_group_ids = instance.workflowdataconditiongroup_set.values_list(
            "condition_group__id", flat=True
        )
        has_action_filter_removal = action_filter_ids != condition_group_ids

        if has_action_filter_removal:
            # Remove the action filters that are not in the update
            instance.workflowdataconditiongroup_set.exclude(
                condition_group__id__in=action_filter_ids
            ).delete()

        for action_filter in action_filters:
            condition_group = self.update_or_create_data_condition_group(action_filter)
            filters.append(condition_group)

            if action_filter.get("id") is None:
                # If it's a new action filter, associate the condition group to the workflow
                WorkflowDataConditionGroup.objects.create(
                    condition_group=condition_group,
                    workflow=instance,
                )

        return filters

    def update(self, instance: Workflow, validated_data: dict[str, Any]) -> Workflow:
        with transaction.atomic(router.db_for_write(Workflow)):
            # Update the Workflow.when_condition_group
            triggers = validated_data.pop("triggers", None)
            if triggers is not None:
                self.update_or_create_data_condition_group(triggers, instance.when_condition_group)

            # Update the Action Filters and Actions
            action_filters = validated_data.pop("action_filters", None)
            if action_filters is not None:
                self.update_action_filters(action_filters)

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
