from typing import List

from django.conf import settings
from django.db.models.signals import pre_save
from django.dispatch import receiver
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import audit_log, features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectAlertRulePermission, ProjectEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.models.rule import RuleSerializerResponse
from sentry.api.serializers.rest_framework.rule import RuleSerializer
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND, RESPONSE_UNAUTHORIZED
from sentry.apidocs.examples.issue_alert_examples import IssueAlertExamples
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.constants import ObjectStatus
from sentry.integrations.slack.utils import RedisRuleStatus
from sentry.mediators import project_rules
from sentry.models import Rule, RuleActivity, RuleActivityType, Team, User
from sentry.rules.actions import trigger_sentry_app_action_creators_for_issues
from sentry.rules.processor import is_condition_slow
from sentry.signals import alert_rule_created
from sentry.tasks.integrations.slack import find_channel_id_for_rule
from sentry.web.decorators import transaction_start


def clean_rule_data(data):
    for datum in data:
        if datum.get("name"):
            del datum["name"]


@receiver(pre_save, sender=Rule)
def pre_save_rule(instance, sender, *args, **kwargs):
    clean_rule_data(instance.data.get("conditions", []))
    clean_rule_data(instance.data.get("actions", []))


def find_duplicate_rule(rule_data, project, rule_id=None):
    matchers = {key for key in list(rule_data.keys()) if key not in ("name", "user_id")}
    extra_fields = ["actions", "environment"]
    matchers.update(extra_fields)
    existing_rules = Rule.objects.exclude(id=rule_id).filter(
        project=project, status=ObjectStatus.ACTIVE
    )
    for existing_rule in existing_rules:
        keys = 0
        matches = 0
        for matcher in matchers:
            if existing_rule.data.get(matcher) and rule_data.get(matcher):
                keys += 1

                if existing_rule.data[matcher] == rule_data[matcher]:
                    matches += 1

            elif matcher in extra_fields:
                if not existing_rule.data.get(matcher) and not rule_data.get(matcher):
                    # neither rule has the matcher
                    continue

                elif matcher == "environment":
                    if existing_rule.environment_id and rule_data.get(matcher):
                        keys += 1
                        if existing_rule.environment_id == rule_data.get(matcher):
                            matches += 1
                    else:
                        keys += 1
                else:
                    # one rule has the matcher and the other one doesn't
                    keys += 1

        if keys == matches:
            return existing_rule
    return None


@extend_schema(tags=["Events"])
@region_silo_endpoint
class ProjectRulesEndpoint(ProjectEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
        "POST": ApiPublishStatus.PUBLIC,
    }
    owner = ApiOwner.ISSUES
    permission_classes = (ProjectAlertRulePermission,)

    @extend_schema(
        operation_id="List Issue Alert Rules for a Project",
        parameters=[GlobalParams.ORG_SLUG, GlobalParams.PROJECT_SLUG],
        request=None,
        responses={
            200: inline_sentry_response_serializer("ListRules", List[RuleSerializerResponse]),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=IssueAlertExamples.LIST_PROJECT_RULES,
    )
    @transaction_start("ProjectRulesEndpoint")
    def get(self, request: Request, project) -> Response:
        """
        Retrieve a list of rules for a given project.

            {method} {path}

        """
        queryset = Rule.objects.filter(
            project=project,
            status=ObjectStatus.ACTIVE,
        ).select_related("project")

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by="-id",
            on_results=lambda x: serialize(x, request.user),
        )

    @extend_schema(
        operation_id="Create an Issue Alert Rule for a Project",
        parameters=[GlobalParams.ORG_SLUG, GlobalParams.PROJECT_SLUG],
        request=None,
        responses={
            201: RuleSerializer,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=IssueAlertExamples.CREATE_ISSUE_ALERT_RULE,
    )
    @transaction_start("ProjectRulesEndpoint")
    def post(self, request: Request, project) -> Response:
        """
        Create a rule

        Create a new rule for the given project.

            {method} {path}
            {{
              "name": "My rule name",
              "owner": "type:id",
              "conditions": [],
              "filters": [],
              "actions": [],
              "actionMatch": "all",
              "filterMatch": "all"
            }}

        """

        serializer = RuleSerializer(
            context={"project": project, "organization": project.organization}, data=request.data
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data

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

        new_rule_is_slow = False
        for condition in conditions:
            if is_condition_slow(condition):
                new_rule_is_slow = True
                break

        rules = Rule.objects.filter(project=project, status=ObjectStatus.ACTIVE)
        slow_rules = 0
        for rule in rules:
            for condition in rule.data["conditions"]:
                if is_condition_slow(condition):
                    slow_rules += 1
                    break

        if new_rule_is_slow:
            max_slow_alerts = settings.MAX_SLOW_CONDITION_ISSUE_ALERTS
            if features.has("organizations:more-slow-alerts", project.organization):
                max_slow_alerts = settings.MAX_MORE_SLOW_CONDITION_ISSUE_ALERTS
            if slow_rules >= max_slow_alerts:
                return Response(
                    {
                        "conditions": [
                            f"You may not exceed {max_slow_alerts} rules with this type of condition per project.",
                        ]
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
        if (
            not new_rule_is_slow
            and (len(rules) - slow_rules) >= settings.MAX_FAST_CONDITION_ISSUE_ALERTS
        ):
            return Response(
                {
                    "conditions": [
                        f"You may not exceed {settings.MAX_FAST_CONDITION_ISSUE_ALERTS} rules with this type of condition per project.",
                    ]
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        kwargs = {
            "name": data["name"],
            "environment": data.get("environment"),
            "project": project,
            "action_match": data["actionMatch"],
            "filter_match": data.get("filterMatch"),
            "conditions": conditions,
            "actions": data.get("actions", []),
            "frequency": data.get("frequency"),
            "user_id": request.user.id,
        }
        duplicate_rule = find_duplicate_rule(kwargs, project)
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

        if data.get("pending_save"):
            client = RedisRuleStatus()
            uuid_context = {"uuid": client.uuid}
            kwargs.update(uuid_context)
            find_channel_id_for_rule.apply_async(kwargs=kwargs)
            return Response(uuid_context, status=202)

        created_alert_rule_ui_component = trigger_sentry_app_action_creators_for_issues(
            kwargs.get("actions")
        )
        rule = project_rules.Creator.run(request=request, **kwargs)

        RuleActivity.objects.create(
            rule=rule, user_id=request.user.id, type=RuleActivityType.CREATED.value
        )
        duplicate_rule = request.query_params.get("duplicateRule")
        wizard_v3 = request.query_params.get("wizardV3")

        self.create_audit_entry(
            request=request,
            organization=project.organization,
            target_object=rule.id,
            event=audit_log.get_event_id("RULE_ADD"),
            data=rule.get_audit_log_data(),
        )
        alert_rule_created.send_robust(
            user=request.user,
            project=project,
            rule=rule,
            rule_type="issue",
            sender=self,
            is_api_token=request.auth is not None,
            alert_rule_ui_component=created_alert_rule_ui_component,
            duplicate_rule=duplicate_rule,
            wizard_v3=wizard_v3,
        )

        return Response(serialize(rule, request.user))
