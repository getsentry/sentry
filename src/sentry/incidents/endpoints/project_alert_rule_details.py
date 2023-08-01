from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import region_silo_endpoint
from sentry.api.serializers import serialize
from sentry.incidents.endpoints.bases import ProjectAlertRuleEndpoint
from sentry.incidents.endpoints.organization_alert_rule_details import (
    fetch_alert_rule,
    remove_alert_rule,
)
from sentry.incidents.logic import get_slack_actions_with_async_lookups
from sentry.incidents.serializers import AlertRuleSerializer as DrfAlertRuleSerializer
from sentry.incidents.utils.sentry_apps import trigger_sentry_app_action_creators_for_incidents
from sentry.integrations.slack.utils import RedisRuleStatus
from sentry.tasks.integrations.slack import find_channel_id_for_alert_rule


@region_silo_endpoint
class ProjectAlertRuleDetailsEndpoint(ProjectAlertRuleEndpoint):
    def get(self, request: Request, project, alert_rule) -> Response:
        """
        Fetch a metric alert rule. @deprecated. Use OrganizationAlertRuleDetailsEndpoint instead.
        ``````````````````
        :auth: required
        """
        return fetch_alert_rule(request, project.organization, alert_rule)

    def put(self, request: Request, project, alert_rule) -> Response:
        data = request.data
        serializer = DrfAlertRuleSerializer(
            context={
                "organization": project.organization,
                "access": request.access,
                "user": request.user,
            },
            instance=alert_rule,
            data=data,
            partial=True,
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
                    "alert_rule_id": alert_rule.id,
                    "user_id": request.user.id,
                }
                find_channel_id_for_alert_rule.apply_async(kwargs=task_args)
                # The user has requested a new Slack channel and we tell the client to check again in a bit
                return Response({"uuid": client.uuid}, status=202)
            else:
                alert_rule = serializer.save()
                return Response(serialize(alert_rule, request.user), status=status.HTTP_200_OK)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request: Request, project, alert_rule) -> Response:
        """
        Delete a metric alert rule. @deprecated. Use OrganizationAlertRuleDetailsEndpoint instead.
        ``````````````````
        :auth: required
        """
        return remove_alert_rule(request, project.organization, alert_rule)
