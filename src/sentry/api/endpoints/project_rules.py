from django.conf import settings
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import audit_log
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectAlertRulePermission, ProjectEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework.rule import RuleSerializer
from sentry.integrations.slack.utils import RedisRuleStatus
from sentry.mediators import project_rules
from sentry.models import Rule, RuleActivity, RuleActivityType, RuleStatus, Team, User
from sentry.rules.actions import trigger_sentry_app_action_creators_for_issues
from sentry.signals import alert_rule_created
from sentry.tasks.integrations.slack import find_channel_id_for_rule
from sentry.web.decorators import transaction_start


@region_silo_endpoint
class ProjectRulesEndpoint(ProjectEndpoint):
    permission_classes = (ProjectAlertRulePermission,)

    @transaction_start("ProjectRulesEndpoint")
    def get(self, request: Request, project) -> Response:
        """
        List a project's rules

        Retrieve a list of rules for a given project.

            {method} {path}

        """
        queryset = Rule.objects.filter(
            project=project, status__in=[RuleStatus.ACTIVE, RuleStatus.INACTIVE]
        ).select_related("project")

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by="-id",
            on_results=lambda x: serialize(x, request.user),
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
        if (
            Rule.objects.filter(project=project, status=RuleStatus.ACTIVE).count()
            >= settings.MAX_ISSUE_ALERTS_PER_PROJECT
        ):
            return Response(
                f"You may not exceed {settings.MAX_ISSUE_ALERTS_PER_PROJECT} rules per project",
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = RuleSerializer(
            context={"project": project, "organization": project.organization}, data=request.data
        )

        if serializer.is_valid():
            data = serializer.validated_data
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
                "actions": data.get("actions", []),
                "frequency": data.get("frequency"),
                "user_id": request.user.id,
            }
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

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
