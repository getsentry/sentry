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
    id = serializers.CharField(required=False, help_text="The ID of the existing alert")
    name = serializers.CharField(required=True, max_length=256, help_text="The name of the alert")
    enabled = serializers.BooleanField(
        required=False, default=True, help_text="Whether the alert is enabled or disabled"
    )
    config = serializers.JSONField(
        required=False,
        help_text="""
        Typically the frequency at which the alert will fire, in minutes.

        - 0: 0 minutes
        - 5: 5 minutes
        - 10: 10 minutes
        - 30: 30 minutes
        - 60: 1 hour
        - 180: 3 hours
        - 720: 12 hours
        - 1440: 24 hours

        ```json
            {
                "frequency":3600
            }
        ```
        """,
    )
    environment_id = serializers.IntegerField(
        required=False, help_text="The name of the environment for the alert to evaluate in"
    )  # TODO fix this, we pass the name, not the ID

    triggers = BaseDataConditionGroupValidator(
        required=False,
        help_text="""The conditions on which the alert will trigger. See available options below.
        ```json
            "triggers": {
                "id": "1234567",
                "organizationId": "1",
                "logicType": "any-short",
                "conditions": [
                    {
                        "id": "123",
                        "type": "first_seen_event",
                        "comparison": true,
                        "conditionResult": true
                    },
                    {
                        "id": "456",
                        "type": "issue_resolved_trigger",
                        "comparison": true,
                        "conditionResult": true
                    },
                    {
                        "id": "789",
                        "type": "reappeared_event",
                        "comparison": true,
                        "conditionResult": true
                    },
                    {
                        "id": "321",
                        "type": "regression_event",
                        "comparison": true,
                        "conditionResult": true
                    }
                ],
                "actions": []
            }
        ```
        """,
    )
    action_filters = serializers.ListField(
        required=False,
        help_text="""The filters to run before the action will fire and the action(s) to fire.

        Below is a basic example. See below for all other options.

        ```json
            "actionFilters": [
                {
                    "logicType": "any-short",
                    "conditions": [
                        {
                            "type": "level",
                            "comparison": {
                                "level": 50,
                                "match": "eq"
                            },
                            "conditionResult": true
                        }
                    ],
                    "actions": [
                        {
                            "id": "123",
                            "type": "email",
                            "integrationId": null,
                            "data": {},
                            "config": {
                                "targetType": "user",
                                "targetDisplay": null,
                                "targetIdentifier": "56789"
                            },
                            "status": "active"
                        }
                    ]
                }
            ]
        ```

        ## Conditions

        **Issue Age**
        - `time`: One of `minute`, `hour`, `day`, or `week`.
        - `value`: A positive integer.
        - `comparisonType`: One of `older` or `newer`.
        ```json
            {
                "type": "age_comparison",
                "comparison": {
                    "time": "minute",
                    "value": 10,
                    "comparisonType": "older"
                },
                "conditionResult": true
            }

        ```

        **Issue Assignment**
        - `targetType`: Who the issue is assigned to
            - `NoOne`: Unassigned
            - `Member`: Assigned to a user
            - `Team`: Assigned to a team
        - `targetIdentifier`: The ID of the user or team from the `targetType`. Enter "" if `targetType` is `NoOne`.
        ```json
            {
                "type": "assigned_to",
                "comparison": {
                    "targetType": "Member",
                    "targetIdentifier": 123456
                },
                "conditionResult": true
            }
        ```

        **Issue Category**
        - `value`: The issue category to filter to.
            - `1`: Error issues
            - `6`: Feedback issues
            - `10`: Outage issues
            - `11`: Metric issues
            - `12`: DB Query issues
            - `13`: HTTP Client issues
            - `14`: Front end issues
            - `15`: Mobile issues
        ```json
            {
                "type": "issue_category",
                "comparison": {
                    "value": 1
                },
                "conditionResult": true
            }
        ```

        **Issue Frequency**
        - `value`: A positive integer representing how many times the issue has to happen before the alert will fire.
        ```json
            {
                "type": "issue_occurrences",
                "comparison": {
                    "value": 10
                },
                "conditionResult": true
            }
        ```

        **De-escalation**
        ```json
            {
                "type": "issue_priority_deescalating",
                "comparison": true,
                "conditionResult": true
            }
        ```

        **Issue Priority**
        - `comparison`: The priority the issue must be for the alert to fire.
            - `75`: High priority
            - `50`: Medium priority
            - `25`: Low priority
        ```json
            {
                "type": "issue_priority_greater_or_equal",
                "comparison": 75,
                "conditionResult": true
            }
        ```

        **Number of Users Affected**
        - `value`: A positive integer representing the number of users that must be affected before the alert will fire.
        - `filters`: A list of additional sub-filters to evaluate before the alert will fire.
        - `interval`: The time period in which to evaluate the value. e.g. Number of users affected by an issue is more than `value` in `interval`.
            - `1min`: 1 minute
            - `5min`: 5 minutes
            - `15min`: 15 minutes
            - `1hr`: 1 hour
            - `1d`: 1 day
            - `1w`: 1 week
            - `30d`: 30 days
        ```json
            {
                "type": "event_unique_user_frequency_count",
                "comparison": {
                    "value": 100,
                    "filters": [{"key": "foo", "match": "eq", "value": "bar"}],
                    "interval": "1h"
                },
                "conditionResult": true
            }
        ```

        **Number of Events**
        - `value`: A positive integer representing the number of events in an issue that must come in before the alert will fire
        - `interval`: The time period in which to evaluate the value. e.g. Number of events in an issue is more than `value` in `interval`.
            - `1min`: 1 minute
            - `5min`: 5 minutes
            - `15min`: 15 minutes
            - `1hr`: 1 hour
            - `1d`: 1 day
            - `1w`: 1 week
            - `30d`: 30 days
        ```json
            {
                "type": "event_frequency_count",
                "comparison": {
                    "value": 100,
                    "interval": "1h"
                },
                "conditionResult": true
            }
        ```

        **Percent of Events**
        - `value`: A positive integer representing the number of events in an issue that must come in before the alert will fire
        - `interval`: The time period in which to evaluate the value. e.g. Number of events in an issue is `comparisonInterval` percent higher `value` compared to `interval`.
            - `1min`: 1 minute
            - `5min`: 5 minutes
            - `15min`: 15 minutes
            - `1hr`: 1 hour
            - `1d`: 1 day
            - `1w`: 1 week
            - `30d`: 30 days
        - `comparisonInterval`: The time period to compare against. See `interval` for options.
        ```json
            {
                "type": "event_frequency_percent",
                "comparison": {
                    "value": 100,
                    "interval": "1h",
                    "comparisonInterval": "1w"
                },
                "conditionResult": true
            }

        ```

        **Percentage of Sessions Affected Count**
        - `value`: A positive integer representing the number of events in an issue that must come in before the alert will fire
        - `interval`: The time period in which to evaluate the value. e.g. Percentage of sessions affected by an issue is more than `value` in `interval`.
            - `1min`: 1 minute
            - `5min`: 5 minutes
            - `15min`: 15 minutes
            - `1hr`: 1 hour
            - `1d`: 1 day
            - `1w`: 1 week
            - `30d`: 30 days
        ```json
            {
                "type": "percent_sessions_count",
                "comparison": {
                    "value": 10,
                    "interval": "1h"
                },
                "conditionResult": true
            }
        ```

        **Percentage of Sessions Affected Percent**
        - `value`: A positive integer representing the number of events in an issue that must come in before the alert will fire
        - `interval`: The time period in which to evaluate the value. e.g. Percentage of sessions affected by an issue is `comparisonInterval` percent higher `value` compared to `interval`.
            - `1min`: 1 minute
            - `5min`: 5 minutes
            - `15min`: 15 minutes
            - `1hr`: 1 hour
            - `1d`: 1 day
            - `1w`: 1 week
            - `30d`: 30 days
        - `comparisonInterval`: The time period to compare against. See `interval` for options.
        ```json
            {
                "type": "percent_sessions_percent",
                "comparison": {
                    "value": 10,
                    "interval": "1h"
                },
                "conditionResult": true
            }
        ```

        **Event Attribute**
        The event's `attribute` value `match` `value`

        - `attribute`: The event attribute to match on. Valid values are: `message`, `platform`, `environment`, `type`, `error.handled`, `error.unhandled`, `error.main_thread`, `exception.type`, `exception.value`, `user.id`, `user.email`, `user.username`, `user.ip_address`, `http.method`, `http.url`, `http.status_code`, `sdk.name`, `stacktrace.code`, `stacktrace.module`, `stacktrace.filename`, `stacktrace.abs_path`, `stacktrace.package`, `unreal.crash_type`, `app.in_foreground`.
        - `match`: The comparison operator
            - `co`: Contains
            - `nc`: Does not contain
            - `eq`: Equals
            - `ne`: Does not equal
            - `sw`: Starts with
            - `ew`: Ends with
            - `is`: Is set
            - `ns`: Is not set
        - `value`: A string. Not required when match is `is` or `ns`.

        ```json
            {
                "type": "event_attribute",
                "comparison": {
                    "match": "co",
                    "value": "bar",
                    "attribute": "message"
                },
                "conditionResult": true
            }
        ```

        **Tagged Event**
        The event's tags `key` match `value`
        - `key`: The tag value
        - `match`: The comparison operator
            - `co`: Contains
            - `nc`: Does not contain
            - `eq`: Equals
            - `ne`: Does not equal
            - `sw`: Starts with
            - `ew`: Ends with
            - `is`: Is set
            - `ns`: Is not set
        - `value`: A string. Not required when match is `is` or `ns`.

        ```json
            {
                "type": "tagged_event",
                "comparison": {
                    "key": "level",
                    "match": "eq",
                    "value": "error"
                },
                "conditionResult": true
            }
        ```

        **Latest Release**
        The event is from the latest release

        ```json
            {
                "type": "latest_release",
                "comparison": true,
                "conditionResult": true
            }
        ```

        **Release Age**
        ```json
            {
                "type": "latest_adopted_release",
                "comparison": {
                    "environment": "12345",
                    "ageComparison": "older",
                    "releaseAgeType": "oldest"
                },
                "conditionResult": true
            }
        ```

        **Event Level**
        The event's level is `match` `level`
        - `match`: The comparison operator
            - `eq`: Equal
            - `gte`: Greater than or equal
            - `lte`: Less than or equal
        - `level`: The event level
            - `50`: Fatal
            - `40`: Error
            - `30`: Warning
            - `20`: Info
            - `10`: Debug
            - `0`: Sample

        ```json
            {
                "type": "level",
                "comparison": {
                    "level": 50,
                    "match": "eq"
                },
                "conditionResult": true
            }
        ```

        ## Actions
        A list of actions that take place when all required conditions and filters for the alert are met. See below for a list of possible actions.


        **Notify on Preferred Channel**
        - `data`: A dictionary with the fallthrough type option when choosing to notify Suggested Assignees. Leave empty if notifying a user or team.
            - `fallthroughType`
                - `ActiveMembers`
                - `AllMembers`
                - `NoOne`
        - `config`: A dictionary with the configuration options for notification.
            - `targetType`: The type of recipient to notify
                - `user`: User
                - `team`: Team
                - `issue_owners`: Suggested Assignees
            - `targetDisplay`: null
            - `targetIdentifier`: The id of the user or team to notify. Leave null for Suggested Assignees.

        ```json
            {
                "type":"email",
                "integrationId":null,
                "data":{},
                "config":{
                    "targetType":"user",
                    "targetDisplay":null,
                    "targetIdentifier":"232692"
                },
                "status":"active"
            },
            {
                "type":"email",
                "integrationId":null,
                "data":{
                    "fallthroughType":"ActiveMembers"
                },
                "config":{
                    "targetType":"issue_owners",
                    "targetDisplay":null,
                    "targetIdentifier":""}
                ,
                "status":"active"
            }
        ```
        **Notify on Slack**
        - `targetDisplay`: The name of the channel to notify in.
        `integrationId`: The stringified ID of the integration.

        ```json
            {
                "type":"slack",
                "config":{
                    "targetType":"specific",
                    "targetIdentifier":"",
                    "targetDisplay":"notify-errors"
                },
                "integrationId":"1",
                "data":{},
                "status":"active"
            }
        ```

        **Notify on PagerDuty**
        - `targetDisplay`: The name of the service to create the ticket in.
        - `integrationId`: The stringified ID of the integration.
        - `data["priority"]`: The severity level for the notification.

        ```json
            {
                "type":"pagerduty",
                "config":{
                    "targetType":"specific",
                    "targetIdentifier":"123456",
                    "targetDisplay":"Error Service"
                    },
                "integrationId":"2345",
                "data":{
                    "priority":"default"
                },
                "status":"active"
            }
        ```

        **Notify on Discord**
        - `targetDisplay`: The name of the service to create the ticket in.
        - `integrationId`: The stringified ID of the integration.
        - `data["tags"]`: Comma separated list of tags to add to the notification.

        ```json
            {
                "type":"discord",
                "config":{
                    "targetType":"specific",
                    "targetIdentifier":"12345",
                    "targetDisplay":"",
                    },
                "integrationId":"1234",
                "data":{
                    "tags":"transaction,environment"
                },
                "status":"active"
            }
        ```

        **Notify on MSTeams**
        - `targetIdentifier` - The integration ID associated with the Microsoft Teams team.
        - `targetDisplay` - The name of the channel to send the notification to.
        - `integrationId`: The stringified ID of the integration.
        ```json
            {
                "type":"msteams",
                "config":{
                    "targetType":"specific",
                    "targetIdentifier":"19:a4b3kghaghgkjah357y6847@thread.skype",
                    "targetDisplay":"notify-errors"
                },
                "integrationId":"1",
                "data":{},
                "status":"active"
            }
        ```

        **Notify on OpsGenie**
        - `targetDisplay`: The name of the Opsgenie team.
        - `targetIdentifier`: The ID of the Opsgenie team to send the notification to.
        - `integrationId`: The stringified ID of the integration.
        - `data["priority"]`: The priority level for the notification.

        ```json
            {
                "type":"opsgenie",
                "config":{
                    "targetType":"specific",
                    "targetIdentifier":"123456-Error-Service",
                    "targetDisplay":"Error Service"
                    },
                "integrationId":"2345",
                "data":{
                    "priority":"P3"
                },
                "status":"active"
            }
        ```

        **Notify on Azure DevOps**
        - `integrationId`: The stringified ID of the integration.
        - `data` - A list of any fields you want to include in the ticket as objects.

        ```json
            {
                "type":"vsts",
                "config":{
                    "targetType":"specific",
                    "targetIdentifier":",
                    "targetDisplay":""
                    },
                "integrationId":"2345",
                "data":{...},
                "status":"active"
            }
        ```

        **Create a Jira ticket**
        - `integrationId`: The stringified ID of the integration.
        - `data` - A list of any fields you want to include in the ticket as objects.

        ```json
            {
                "type":"jira",
                "config":{
                    "targetType":"specific",
                    "targetIdentifier":",
                    "targetDisplay":""
                    },
                "integrationId":"2345",
                "data":{...},
                "status":"active"
            }
        ```

        **Create a Jira Server ticket**
        - `integrationId`: The stringified ID of the integration.
        - `data` - A list of any fields you want to include in the ticket as objects.

        ```json
            {
                "type":"jira_server",
                "config":{
                    "targetType":"specific",
                    "targetIdentifier":",
                    "targetDisplay":""
                    },
                "integrationId":"2345",
                "data":{...},
                "status":"active"
            }
        ```

        **Create a GitHub issue**
        - `integrationId`: The stringified ID of the integration.
        - `data` - A list of any fields you want to include in the ticket as objects.

        ```json
            {
                "type":"github",
                "config":{
                    "targetType":"specific",
                    "targetIdentifier":",
                    "targetDisplay":""
                    },
                "integrationId":"2345",
                "data":{...},
                "status":"active"
            }
        ```
        """,
    )

    def _split_action_and_condition_group(
        self, action_filter: dict[str, Any]
    ) -> tuple[ListInputData, InputData]:
        try:
            actions = action_filter.pop("actions")
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

            validated_actions = []
            for action in actions:
                action_validator = BaseActionValidator(data=action, context=self.context)
                action_validator.is_valid(raise_exception=True)

                # update because the validated data does not contain "id" for updates
                action.update(action_validator.validated_data)
                validated_actions.append(action)

            action_filter["actions"] = validated_actions

        return value

    def _update_or_create(
        self,
        input_data: dict[str, Any],
        validator: serializers.Serializer,
        Model: type[ModelType],
    ) -> ModelType:
        input_id = input_data.get("id")
        instance = None
        partial = False

        # Determine if this is an update or create operation
        if input_id:
            instance = Model.objects.get(id=input_id)
            # partial update since we are updating an existing instance
            # https://www.django-rest-framework.org/api-guide/serializers/#partial-updates
            partial = True

        serializer = validator.__class__(
            instance=instance, data=input_data, context=self.context, partial=partial
        )

        if not serializer.is_valid():
            raise serializers.ValidationError(serializer.errors)

        return serializer.save()

    def _update_or_create_action(
        self,
        input_data: dict[str, Any],
    ) -> Action:
        # Validating actions hits external APIs. We already validated the data with WorkflowValidator.is_valid().
        # Avoid re-validating the data by saving the Action directly.

        input_id = input_data.get("id")
        instance = None

        # Determine if this is an update or create operation
        if input_id:
            instance = Action.objects.get(id=input_id)
            instance.update(**input_data)
            return instance

        return Action.objects.create(**input_data)

    def update_or_create_actions(
        self,
        actions_data: ListInputData,
        condition_group: DataConditionGroup,
    ) -> None:
        remove_items_by_api_input(
            actions_data, condition_group.dataconditiongroupaction_set, "action__id"
        )

        for action in actions_data:
            action_instance = self._update_or_create_action(action)

            # If this is a new action, associate it to the condition group
            if action.get("id") is None:
                DataConditionGroupAction.objects.create(
                    action=action_instance,
                    condition_group=condition_group,
                )

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

        # If an instance is provided but no id in the data, use the instance's id to ensure we update the existing condition group
        if instance and not condition_group_id:
            condition_group_data["id"] = str(instance.id)

        actions = condition_group_data.pop("actions", None)
        condition_group = self._update_or_create(
            condition_group_data, validator, DataConditionGroup
        )

        if actions is not None:
            self.update_or_create_actions(actions, condition_group)

        return condition_group

    def _validate_action_filter_ownership(self, action_filters: ListInputData) -> None:
        workflow = self.context["workflow"]

        valid_dcg_ids: set[int] = set(
            workflow.workflowdataconditiongroup_set.values_list("condition_group_id", flat=True)
        )
        valid_action_ids: set[int] = set(
            DataConditionGroupAction.objects.filter(
                condition_group_id__in=valid_dcg_ids
            ).values_list("action_id", flat=True)
        )

        for action_filter in action_filters:
            dcg_id = action_filter.get("id")
            if dcg_id is not None and int(dcg_id) not in valid_dcg_ids:
                raise serializers.ValidationError(
                    f"Action filter ID {dcg_id} does not belong to this workflow"
                )

            for action in action_filter.get("actions", []):
                action_id = action.get("id")
                if action_id is not None and int(action_id) not in valid_action_ids:
                    raise serializers.ValidationError(
                        f"Action ID {action_id} does not belong to this workflow"
                    )

    def update_action_filters(self, action_filters: ListInputData) -> list[DataConditionGroup]:
        instance = self.context["workflow"]
        filters: list[DataConditionGroup] = []

        self._validate_action_filter_ownership(action_filters)

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
