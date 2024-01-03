from __future__ import annotations

import logging

from drf_spectacular.utils import extend_schema
from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics, audit_log
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.rule import RuleEndpoint
from sentry.api.endpoints.project_rules import find_duplicate_rule
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
from sentry.constants import ObjectStatus, SentryAppStatus
from sentry.integrations.jira.actions.create_ticket import JiraCreateTicketAction
from sentry.integrations.jira_server.actions.create_ticket import JiraServerCreateTicketAction
from sentry.integrations.slack.utils import RedisRuleStatus
from sentry.mediators.project_rules.updater import Updater
from sentry.models.apiapplication import ApiApplication
from sentry.models.integrations.sentry_app import SentryApp
from sentry.models.integrations.sentry_app_component import SentryAppComponent
from sentry.models.integrations.sentry_app_installation import (
    SentryAppInstallation,
    prepare_ui_component,
)
from sentry.models.rule import NeglectedRule, RuleActivity, RuleActivityType
from sentry.models.scheduledeletion import RegionScheduledDeletion
from sentry.models.team import Team
from sentry.models.user import User
from sentry.rules.actions import trigger_sentry_app_action_creators_for_issues
from sentry.signals import alert_rule_edited
from sentry.tasks.integrations.slack import find_channel_id_for_rule
from sentry.web.decorators import transaction_start

logger = logging.getLogger(__name__)


class ProjectRuleDetailsPutSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=64, help_text="The name for the rule.")
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
            GlobalParams.ORG_SLUG,
            GlobalParams.PROJECT_SLUG,
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
    @transaction_start("ProjectRuleDetailsEndpoint")
    def get(self, request: Request, project, rule) -> Response:
        """
        Return details on an individual issue alert rule.

        An issue alert rule triggers whenever a new event is received for any issue in a project that matches the specified alert conditions. These conditions can include a resolved issue re-appearing or an issue affecting many users. Alert conditions have three parts:
        - Triggers - specify what type of activity you'd like monitored or when an alert should be triggered.
        - Filters - help control noise by triggering an alert only if the issue matches the specified criteria.
        - Actions - specify what should happen when the trigger conditions are met and the filters match.
        """
        # Serialize Rule object
        serialized_rule = serialize(
            rule, request.user, RuleSerializer(request.GET.getlist("expand", []))
        )

        errors = []
        # Prepare Rule Actions that are SentryApp components using the meta fields
        for action in serialized_rule.get("actions", []):
            if action.get("_sentry_app_installation") and action.get("_sentry_app_component"):
                # TODO(hybridcloud) This is nasty and should be fixed.
                # Because all of the prepare_* functions currently operate on ORM
                # records we need to convert our RpcSentryApp and dict data into detached
                # ORM models and stitch together relations used in preparing UI components.
                installation = SentryAppInstallation(
                    **action.get("_sentry_app_installation", {}),
                )
                # The api_token_id field is nulled out to prevent relation traversal as these
                # ORM objects are turned back into RPC objects.
                installation.api_token_id = None

                rpc_app = action.get("_sentry_app")
                installation.sentry_app = SentryApp(
                    id=rpc_app.id,
                    scope_list=rpc_app.scope_list,
                    application_id=rpc_app.application_id,
                    application=ApiApplication(
                        id=rpc_app.application.id,
                        client_id=rpc_app.application.client_id,
                        client_secret=rpc_app.application.client_secret,
                    ),
                    proxy_user_id=rpc_app.proxy_user_id,
                    owner_id=rpc_app.owner_id,
                    name=rpc_app.name,
                    slug=rpc_app.slug,
                    uuid=rpc_app.uuid,
                    events=rpc_app.events,
                    webhook_url=rpc_app.webhook_url,
                    status=SentryAppStatus.as_int(rpc_app.status),
                    metadata=rpc_app.metadata,
                )
                component = prepare_ui_component(
                    installation,
                    SentryAppComponent(**action.get("_sentry_app_component")),
                    project.slug,
                    action.get("settings"),
                )

                if component is None:
                    errors.append(
                        {"detail": f"Could not fetch details from {installation.sentry_app.name}"}
                    )
                    action["disabled"] = True
                    continue

                action["formFields"] = component.schema.get("settings", {})

                # Delete meta fields
                del action["_sentry_app_installation"]
                del action["_sentry_app_component"]

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

        if len(errors):
            serialized_rule["errors"] = errors

        return Response(serialized_rule)

    @extend_schema(
        operation_id="Update an Issue Alert Rule",
        parameters=[
            GlobalParams.ORG_SLUG,
            GlobalParams.PROJECT_SLUG,
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
    @transaction_start("ProjectRuleDetailsEndpoint")
    def put(self, request: Request, project, rule) -> Response:
        """
        Updates an issue alert rule.
        > Warning: Calling this endpoint fully overwrites the specified issue alert.

        An issue alert rule triggers whenever a new event is received for any issue in a project that matches the specified alert conditions. These conditions can include a resolved issue re-appearing or an issue affecting many users. Alert conditions have three parts:
        - Triggers - specify what type of activity you'd like monitored or when an alert should be triggered.
        - Filters - help control noise by triggering an alert only if the issue matches the specified criteria.
        - Actions - specify what should happen when the trigger conditions are met and the filters match.
        """
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
                try:
                    kwargs["owner"] = owner.resolve_to_actor().id
                except (User.DoesNotExist, Team.DoesNotExist):
                    return Response(
                        "Could not resolve owner",
                        status=status.HTTP_400_BAD_REQUEST,
                    )

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

            trigger_sentry_app_action_creators_for_issues(actions=kwargs["actions"])

            updated_rule = Updater.run(rule=rule, request=request, **kwargs)

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

            return Response(serialize(updated_rule, request.user))

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @extend_schema(
        operation_id="Delete an Issue Alert Rule",
        parameters=[
            GlobalParams.ORG_SLUG,
            GlobalParams.PROJECT_SLUG,
            IssueAlertParams.ISSUE_RULE_ID,
        ],
        responses={
            202: RESPONSE_ACCEPTED,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    @transaction_start("ProjectRuleDetailsEndpoint")
    def delete(self, request: Request, project, rule) -> Response:
        """
        Delete a specific issue alert rule.

        An issue alert rule triggers whenever a new event is received for any issue in a project that matches the specified alert conditions. These conditions can include a resolved issue re-appearing or an issue affecting many users. Alert conditions have three parts:
        - Triggers: specify what type of activity you'd like monitored or when an alert should be triggered.
        - Filters: help control noise by triggering an alert only if the issue matches the specified criteria.
        - Actions: specify what should happen when the trigger conditions are met and the filters match.
        """
        rule.update(status=ObjectStatus.PENDING_DELETION)
        RuleActivity.objects.create(
            rule=rule, user_id=request.user.id, type=RuleActivityType.DELETED.value
        )
        scheduled = RegionScheduledDeletion.schedule(rule, days=0, actor=request.user)
        self.create_audit_entry(
            request=request,
            organization=project.organization,
            target_object=rule.id,
            event=audit_log.get_event_id("RULE_REMOVE"),
            data=rule.get_audit_log_data(),
            transaction_id=scheduled.id,
        )
        return Response(status=202)
