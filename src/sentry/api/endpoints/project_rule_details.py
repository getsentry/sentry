from __future__ import annotations

import logging

from django.db import router, transaction
from drf_spectacular.utils import extend_schema
from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics, audit_log, features
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.rule import RuleEndpoint
from sentry.api.endpoints.project_rules import find_duplicate_rule, send_confirmation_notification
from sentry.api.fields.actor import ActorField
from sentry.api.serializers import serialize
from sentry.api.serializers.models.rule import RuleSerializer
from sentry.api.serializers.rest_framework.rule import RuleNodeField
from sentry.api.serializers.rest_framework.rule import RuleSerializer as DrfRuleSerializer
from sentry.apidocs.constants import (
    RESPONSE_ACCEPTED,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.examples.issue_alert_examples import IssueAlertExamples
from sentry.apidocs.parameters import GlobalParams, IssueAlertParams
from sentry.constants import ObjectStatus
from sentry.deletions.models.scheduleddeletion import RegionScheduledDeletion
from sentry.integrations.jira.actions.create_ticket import JiraCreateTicketAction
from sentry.integrations.jira_server.actions.create_ticket import JiraServerCreateTicketAction
from sentry.integrations.slack.tasks.find_channel_id_for_rule import find_channel_id_for_rule
from sentry.integrations.slack.utils.rule_status import RedisRuleStatus
from sentry.models.rule import NeglectedRule, Rule, RuleActivity, RuleActivityType
from sentry.projects.project_rules.updater import ProjectRuleUpdater
from sentry.rules.actions import trigger_sentry_app_action_creators_for_issues
from sentry.rules.actions.utils import get_changed_data, get_updated_rule_data
from sentry.sentry_apps.utils.errors import SentryAppBaseError
from sentry.signals import alert_rule_edited
from sentry.types.actor import Actor
from sentry.utils import metrics
from sentry.workflow_engine.migration_helpers.issue_alert_dual_write import (
    delete_migrated_issue_alert,
)

logger = logging.getLogger(__name__)


class ProjectRuleDetailsPutSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=256, help_text="The name for the rule.")
    actionMatch = serializers.ChoiceField(
        choices=(
            ("all", "All conditions must evaluate to true."),
            ("any", "At least one of the conditions must evaluate to true."),
            ("none", "All conditions must evaluate to false."),
        ),
        help_text="A string determining which of the conditions need to be true before any filters are evaluated.",
    )
    conditions = serializers.ListField(
        child=RuleNodeField(type="condition/event"),
        help_text="A list of triggers that determine when the rule fires. See [Create an Issue Alert Rule](/api/alerts/create-an-issue-alert-rule-for-a-project) for valid conditions.",
    )
    actions = serializers.ListField(
        child=RuleNodeField(type="action/event"),
        help_text="A list of actions that take place when all required conditions and filters for the rule are met. See [Create an Issue Alert Rule](/api/alerts/create-an-issue-alert-rule-for-a-project) for valid actions.",
    )
    frequency = serializers.IntegerField(
        min_value=5,
        max_value=60 * 24 * 30,
        help_text="How often to perform the actions once for an issue, in minutes. The valid range is `5` to `43200`.",
    )
    environment = serializers.CharField(
        required=False, allow_null=True, help_text="The name of the environment to filter by."
    )
    filterMatch = serializers.ChoiceField(
        choices=(
            ("all", "All filters must evaluate to true."),
            ("any", "At least one of the filters must evaluate to true."),
            ("none", "All filters must evaluate to false."),
        ),
        required=False,
        help_text="A string determining which filters need to be true before any actions take place.",
    )
    filters = serializers.ListField(
        child=RuleNodeField(type="filter/event"),
        required=False,
        help_text="A list of filters that determine if a rule fires after the necessary conditions have been met. See [Create an Issue Alert Rule](/api/alerts/create-an-issue-alert-rule-for-a-project) for valid filters.",
    )
    owner = ActorField(
        required=False, allow_null=True, help_text="The ID of the team or user that owns the rule."
    )


@extend_schema(tags=["Alerts"])
@region_silo_endpoint
class ProjectRuleDetailsEndpoint(RuleEndpoint):
    publish_status = {
        "DELETE": ApiPublishStatus.PUBLIC,
        "GET": ApiPublishStatus.PUBLIC,
        "PUT": ApiPublishStatus.PUBLIC,
    }

    @extend_schema(
        operation_id="Retrieve an Issue Alert Rule for a Project",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
            IssueAlertParams.ISSUE_RULE_ID,
        ],
        responses={
            200: RuleSerializer,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=IssueAlertExamples.GET_PROJECT_RULE,
    )
    def get(self, request: Request, project, rule) -> Response:
        """
        Return details on an individual issue alert rule.

        An issue alert rule triggers whenever a new event is received for any issue in a project that matches the specified alert conditions. These conditions can include a resolved issue re-appearing or an issue affecting many users. Alert conditions have three parts:
        - Triggers - specify what type of activity you'd like monitored or when an alert should be triggered.
        - Filters - help control noise by triggering an alert only if the issue matches the specified criteria.
        - Actions - specify what should happen when the trigger conditions are met and the filters match.
        """
        # Serialize Rule object
        rule_serializer = RuleSerializer(
            expand=request.GET.getlist("expand", []),
            prepare_component_fields=True,
            project_slug=project.slug,
        )
        serialized_rule = serialize(rule, request.user, rule_serializer)
        # Prepare Rule Actions that are SentryApp components using the meta fields
        for action in serialized_rule.get("actions", []):
            # TODO(nisanthan): This is a temporary fix. We need to save both the label and value of
            #                  the selected choice and not save all the choices.
            if action.get("id") in (JiraCreateTicketAction.id, JiraServerCreateTicketAction.id):
                for field in action.get("dynamic_form_fields", []):
                    if field.get("choices"):
                        field["choices"] = [
                            p
                            for p in field.get("choices", [])
                            if isinstance(p[0], str) and isinstance(p[1], str)
                        ]

        return Response(serialized_rule)

    @extend_schema(
        operation_id="Update an Issue Alert Rule",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
            IssueAlertParams.ISSUE_RULE_ID,
        ],
        request=ProjectRuleDetailsPutSerializer,
        responses={
            200: RuleSerializer,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=IssueAlertExamples.UPDATE_PROJECT_RULE,
    )
    def put(self, request: Request, project, rule) -> Response:
        """
        Updates an issue alert rule.
        > Warning: Calling this endpoint fully overwrites the specified issue alert.

        An issue alert rule triggers whenever a new event is received for any issue in a project that matches the specified alert conditions. These conditions can include a resolved issue re-appearing or an issue affecting many users. Alert conditions have three parts:
        - Triggers - specify what type of activity you'd like monitored or when an alert should be triggered.
        - Filters - help control noise by triggering an alert only if the issue matches the specified criteria.
        - Actions - specify what should happen when the trigger conditions are met and the filters match.
        """
        rule_data_before = dict(rule.data)
        if rule.environment_id:
            rule_data_before["environment_id"] = rule.environment_id
        if rule.owner_team_id or rule.owner_user_id:
            rule_data_before["owner"] = Actor.from_id(
                user_id=rule.owner_user_id, team_id=rule.owner_team_id
            )
        rule_data_before["label"] = rule.label

        serializer = DrfRuleSerializer(
            context={"project": project, "organization": project.organization},
            data=request.data,
            partial=True,
        )

        if serializer.is_valid():
            data = serializer.validated_data

            # this is temporary for opting out of a migration of rules that haven't been
            # interacted with by the user for x period of time
            explicit_opt_out = request.data.get("optOutExplicit")
            edit_opt_out = request.data.get("optOutEdit")
            if explicit_opt_out or edit_opt_out:
                try:
                    neglected_rule = NeglectedRule.objects.get(
                        rule=rule.id, organization=project.organization, opted_out=False
                    )
                    neglected_rule.opted_out = True
                    neglected_rule.save()

                    analytics_data = {
                        "rule_id": rule.id,
                        "user_id": request.user.id,
                        "organization_id": project.organization.id,
                    }

                    if explicit_opt_out:
                        analytics.record(
                            "rule_disable_opt_out.explicit",
                            **analytics_data,
                        )
                    if edit_opt_out:
                        analytics.record(
                            "rule_disable_opt_out.edit",
                            **analytics_data,
                        )
                except NeglectedRule.DoesNotExist:
                    pass

                except NeglectedRule.MultipleObjectsReturned:
                    logger.info(
                        "rule_disable_opt_out.multiple",
                        extra={
                            "rule_id": rule.id,
                            "org_id": project.organization.id,
                        },
                    )

            if not data.get("actions", []):
                return Response(
                    {
                        "actions": [
                            "You must add an action for this alert to fire.",
                        ]
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # combine filters and conditions into one conditions criteria for the rule object
            conditions = data.get("conditions", [])
            if "filters" in data:
                conditions.extend(data["filters"])

            kwargs = {
                "name": data["name"],
                "environment": data.get("environment"),
                "project": project,
                "action_match": data["actionMatch"],
                "filter_match": data.get("filterMatch"),
                "conditions": conditions,
                "actions": data["actions"],
                "frequency": data.get("frequency"),
            }
            duplicate_rule = find_duplicate_rule(project=project, rule_data=kwargs, rule_id=rule.id)
            if duplicate_rule:
                return Response(
                    {
                        "name": [
                            f"This rule is an exact duplicate of '{duplicate_rule.label}' in this project and may not be created.",
                        ],
                        "ruleId": [duplicate_rule.id],
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            owner = data.get("owner")
            if owner:
                kwargs["owner"] = owner

            if rule.status == ObjectStatus.DISABLED:
                rule.status = ObjectStatus.ACTIVE
                rule.save()
                analytics.record(
                    "rule_reenable.edit",
                    rule_id=rule.id,
                    user_id=request.user.id,
                    organization_id=project.organization.id,
                )

            if data.get("pending_save"):
                client = RedisRuleStatus()
                kwargs.update({"uuid": client.uuid, "rule_id": rule.id})
                find_channel_id_for_rule.apply_async(kwargs=kwargs)

                context = {"uuid": client.uuid}
                return Response(context, status=202)

            try:
                trigger_sentry_app_action_creators_for_issues(actions=kwargs["actions"])
            except SentryAppBaseError as e:
                response = e.response_from_exception()
                response.data["actions"] = [response.data.pop("detail")]

                return response

            updated_rule = ProjectRuleUpdater(
                rule=rule,
                project=project,
                name=kwargs["name"],
                owner=owner,
                environment=kwargs["environment"],
                action_match=kwargs["action_match"],
                filter_match=kwargs["filter_match"],
                actions=kwargs["actions"],
                conditions=conditions,
                frequency=kwargs["frequency"],
                request=request,
            ).run()

            RuleActivity.objects.create(
                rule=updated_rule, user_id=request.user.id, type=RuleActivityType.UPDATED.value
            )
            self.create_audit_entry(
                request=request,
                organization=project.organization,
                target_object=updated_rule.id,
                event=audit_log.get_event_id("RULE_EDIT"),
                data=updated_rule.get_audit_log_data(),
            )
            alert_rule_edited.send_robust(
                user=request.user,
                project=project,
                rule=rule,
                rule_type="issue",
                sender=self,
                is_api_token=request.auth is not None,
            )
            if features.has(
                "organizations:rule-create-edit-confirm-notification", project.organization
            ):
                new_rule_data = get_updated_rule_data(rule)
                changed_data = get_changed_data(rule, new_rule_data, rule_data_before)
                send_confirmation_notification(rule=rule, new=False, changed=changed_data)
                metrics.incr(
                    "rule_confirmation.edit.notification.sent",
                    skip_internal=False,
                )
            return Response(serialize(updated_rule, request.user))

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @extend_schema(
        operation_id="Delete an Issue Alert Rule",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
            IssueAlertParams.ISSUE_RULE_ID,
        ],
        responses={
            202: RESPONSE_ACCEPTED,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def delete(self, request: Request, project, rule) -> Response:
        """
        Delete a specific issue alert rule.

        An issue alert rule triggers whenever a new event is received for any issue in a project that matches the specified alert conditions. These conditions can include a resolved issue re-appearing or an issue affecting many users. Alert conditions have three parts:
        - Triggers: specify what type of activity you'd like monitored or when an alert should be triggered.
        - Filters: help control noise by triggering an alert only if the issue matches the specified criteria.
        - Actions: specify what should happen when the trigger conditions are met and the filters match.
        """
        rule_id = rule.id

        with transaction.atomic(router.db_for_write(Rule)):
            rule.update(status=ObjectStatus.PENDING_DELETION)
            RuleActivity.objects.create(
                rule=rule, user_id=request.user.id, type=RuleActivityType.DELETED.value
            )
            scheduled = RegionScheduledDeletion.schedule(rule, days=0, actor=request.user)

            if features.has(
                "organizations:workflow-engine-issue-alert-dual-write", project.organization
            ):
                workflow_id = delete_migrated_issue_alert(rule)
                logger.info(
                    "workflow_engine.issue_alert.deleted",
                    extra={"rule_id": rule_id, "workflow_id": workflow_id},
                )

        self.create_audit_entry(
            request=request,
            organization=project.organization,
            target_object=rule.id,
            event=audit_log.get_event_id("RULE_REMOVE"),
            data=rule.get_audit_log_data(),
            transaction_id=scheduled.id,
        )
        return Response(status=202)
