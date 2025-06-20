from typing import Any, TypeVar

from django.conf import settings
from django.db import router, transaction
from rest_framework import serializers

from sentry import audit_log, features
from sentry.api.serializers.rest_framework import CamelSnakeSerializer
from sentry.db import models
from sentry.models.organization import Organization
from sentry.utils.audit import create_audit_entry
from sentry.workflow_engine.endpoints.validators.base import (
    BaseActionValidator,
    BaseDataConditionGroupValidator,
)
from sentry.workflow_engine.endpoints.validators.utils import (
    remove_items_by_api_input,
    validate_json_schema,
)
from sentry.workflow_engine.models import (
    Action,
    DataConditionGroup,
    DataConditionGroupAction,
    Workflow,
    WorkflowDataConditionGroup,
)

InputData = dict[str, Any]
ListInputData = list[InputData]
ModelType = TypeVar("ModelType", bound=models.Model)


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
    ) -> tuple[ListInputData, InputData]:
        try:
            actions = action_filter["actions"]
        except KeyError:
            raise serializers.ValidationError("Missing actions key in action filter")

        return actions, action_filter

    def validate_config(self, value) -> bool:
        schema = Workflow.config_schema
        return validate_json_schema(value, schema)

    def validate_action_filters(self, value: ListInputData) -> ListInputData:
        for action_filter in value:
            actions, condition_group = self._split_action_and_condition_group(action_filter)
            BaseDataConditionGroupValidator(data=condition_group).is_valid(raise_exception=True)

            for action in actions:
                BaseActionValidator(data=action, context=self.context).is_valid(
                    raise_exception=True
                )

        return value

    def _update_or_create(
        self,
        input_data: dict[str, Any],
        validator: serializers.Serializer,
        Model: type[ModelType],
    ) -> ModelType:
        if input_data.get("id") is None:
            return validator.create(input_data)

        instance = Model.objects.get(id=input_data["id"])
        validator.update(instance, input_data)
        return instance

    def update_or_create_actions(
        self,
        actions_data: ListInputData,
        condition_group: DataConditionGroup,
    ) -> None:
        remove_items_by_api_input(
            actions_data, condition_group.dataconditiongroupaction_set, "action__id"
        )

        validator = BaseActionValidator(context=self.context)
        for action in actions_data:
            self._update_or_create(action, validator, Action)

    def update_or_create_data_condition_group(
        self,
        condition_group_data: InputData,
        instance: DataConditionGroup | None = None,
    ) -> DataConditionGroup:
        validator = BaseDataConditionGroupValidator(context=self.context)

        condition_group_id = condition_group_data.get("id")
        if instance and condition_group_id and condition_group_id != str(instance.id):
            raise serializers.ValidationError(
                f"Invalid Condition Group ID {condition_group_data.get('id')}"
            )

        actions = condition_group_data.pop("actions", None)
        condition_group = self._update_or_create(
            condition_group_data, validator, DataConditionGroup
        )

        if actions is not None:
            self.update_or_create_actions(actions, condition_group)

        return condition_group

    def update_action_filters(self, action_filters: ListInputData) -> list[DataConditionGroup]:
        instance = self.context["workflow"]
        filters: list[DataConditionGroup] = []

        remove_items_by_api_input(
            action_filters, instance.workflowdataconditiongroup_set, "condition_group__id"
        )

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

    def update(self, instance: Workflow, validated_data: InputData) -> Workflow:
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

    def _validate_workflow_limits(self) -> None:
        """
        Validate that the organization has not exceeded the maximum number of workflows.
        Raise a validation error if the limit is exceeded.
        """
        org = self.context["organization"]
        assert isinstance(org, Organization)
        workflow_count = Workflow.objects.filter(organization_id=org.id).count()
        if features.has("organizations:more-workflows", org):
            max_workflows = settings.MAX_MORE_WORKFLOWS_PER_ORG
        else:
            max_workflows = settings.MAX_WORKFLOWS_PER_ORG

        if workflow_count >= max_workflows:
            raise serializers.ValidationError(
                f"You may not exceed {max_workflows} workflows per organization."
            )

    def create(self, validated_value: InputData) -> Workflow:
        condition_group_validator = BaseDataConditionGroupValidator(context=self.context)
        action_validator = BaseActionValidator(context=self.context)

        self._validate_workflow_limits()

        with transaction.atomic(router.db_for_write(Workflow)):
            when_condition_group = condition_group_validator.create(validated_value["triggers"])

            workflow = Workflow.objects.create(
                name=validated_value["name"],
                enabled=validated_value["enabled"],
                config=validated_value["config"],
                organization_id=self.context["organization"].id,
                environment_id=validated_value.get("environment_id"),
                when_condition_group=when_condition_group,
                created_by_id=self.context["request"].user.id,
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
