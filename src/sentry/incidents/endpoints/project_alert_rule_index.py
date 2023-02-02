from copy import deepcopy

from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectAlertRulePermission, ProjectEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.paginator import (
    CombinedQuerysetIntermediary,
    CombinedQuerysetPaginator,
    OffsetPaginator,
)
from sentry.api.serializers import CombinedRuleSerializer, serialize
from sentry.incidents.logic import get_slack_actions_with_async_lookups
from sentry.incidents.models import AlertRule
from sentry.incidents.serializers import AlertRuleSerializer
from sentry.incidents.utils.sentry_apps import trigger_sentry_app_action_creators_for_incidents
from sentry.integrations.slack.utils import RedisRuleStatus
from sentry.models import Rule, RuleStatus
from sentry.signals import alert_rule_created
from sentry.snuba.dataset import Dataset
from sentry.tasks.integrations.slack import find_channel_id_for_alert_rule


@region_silo_endpoint
class ProjectCombinedRuleIndexEndpoint(ProjectEndpoint):
    def get(self, request: Request, project) -> Response:
        """
        Fetches alert rules and legacy rules for a project
        """
        alert_rules = AlertRule.objects.fetch_for_project(project)
        if not features.has("organizations:performance-view", project.organization):
            # Filter to only error alert rules
            alert_rules = alert_rules.filter(snuba_query__dataset=Dataset.Events.value)

        alert_rule_intermediary = CombinedQuerysetIntermediary(alert_rules, ["date_added"])
        rule_intermediary = CombinedQuerysetIntermediary(
            Rule.objects.filter(
                project=project, status__in=[RuleStatus.ACTIVE, RuleStatus.INACTIVE]
            ),
            ["date_added"],
        )

        return self.paginate(
            request,
            paginator_cls=CombinedQuerysetPaginator,
            on_results=lambda x: serialize(x, request.user, CombinedRuleSerializer()),
            default_per_page=25,
            intermediaries=[alert_rule_intermediary, rule_intermediary],
            desc=True,
        )


@region_silo_endpoint
class ProjectAlertRuleIndexEndpoint(ProjectEndpoint):
    permission_classes = (ProjectAlertRulePermission,)

    def get(self, request: Request, project) -> Response:
        """
        Fetches alert rules for a project
        """
        if not features.has("organizations:incidents", project.organization, actor=request.user):
            raise ResourceDoesNotExist

        alert_rules = AlertRule.objects.fetch_for_project(project)
        if not features.has("organizations:performance-view", project.organization):
            # Filter to only error alert rules
            alert_rules = alert_rules.filter(snuba_query__dataset=Dataset.Events.value)

        return self.paginate(
            request,
            queryset=alert_rules,
            order_by="-date_added",
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(x, request.user),
            default_per_page=25,
        )

    def post(self, request: Request, project) -> Response:
        """
        Create an alert rule
        """
        if not features.has("organizations:incidents", project.organization, actor=request.user):
            raise ResourceDoesNotExist

        data = deepcopy(request.data)
        data["projects"] = [project.slug]

        serializer = AlertRuleSerializer(
            context={
                "organization": project.organization,
                "access": request.access,
                "user": request.user,
                "ip_address": request.META.get("REMOTE_ADDR"),
            },
            data=data,
        )
        if serializer.is_valid():
            trigger_sentry_app_action_creators_for_incidents(serializer.validated_data)
            if get_slack_actions_with_async_lookups(project.organization, request.user, data):
                # need to kick off an async job for Slack
                client = RedisRuleStatus()
                task_args = {
                    "organization_id": project.organization_id,
                    "uuid": client.uuid,
                    "data": data,
                    "user_id": request.user.id,
                }
                find_channel_id_for_alert_rule.apply_async(kwargs=task_args)
                return Response({"uuid": client.uuid}, status=202)
            else:
                alert_rule = serializer.save()
                referrer = request.query_params.get("referrer")
                session_id = request.query_params.get("sessionId")
                duplicate_rule = request.query_params.get("duplicateRule")
                wizard_v3 = request.query_params.get("wizardV3")
                alert_rule_created.send_robust(
                    user=request.user,
                    project=project,
                    rule=alert_rule,
                    rule_type="metric",
                    sender=self,
                    referrer=referrer,
                    session_id=session_id,
                    is_api_token=request.auth is not None,
                    duplicate_rule=duplicate_rule,
                    wizard_v3=wizard_v3,
                )
                return Response(serialize(alert_rule, request.user), status=status.HTTP_201_CREATED)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
