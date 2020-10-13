from __future__ import absolute_import

from rest_framework import status
from rest_framework.response import Response

from sentry.api.serializers import serialize
from sentry.api.serializers.models.alert_rule import AlertRuleSerializer
from sentry.incidents.endpoints.bases import ProjectAlertRuleEndpoint
from sentry.incidents.endpoints.serializers import AlertRuleSerializer as DrfAlertRuleSerializer
from sentry.incidents.logic import AlreadyDeletedError, ChannelLookupTimeoutError, delete_alert_rule
from sentry.integrations.slack import tasks


class ProjectAlertRuleDetailsEndpoint(ProjectAlertRuleEndpoint):
    def get(self, request, project, alert_rule):
        """
        Fetch an alert rule.
        ``````````````````
        :auth: required
        """
        data = serialize(alert_rule, request.user, AlertRuleSerializer())
        return Response(data)

    def put(self, request, project, alert_rule):
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
            try:
                alert_rule = serializer.save()
            except ChannelLookupTimeoutError:
                # need to kick off an async job for Slack
                client = tasks.RedisRuleStatus()
                uuid_context = {"uuid": client.uuid}
                # add params to data
                data.update(uuid_context)
                data["organization_id"] = project.organization_id
                tasks.find_channel_id_for_alert_rule.apply_async(kwargs=data)
                return Response(uuid_context, status=202)
            else:
                return Response(serialize(alert_rule, request.user), status=status.HTTP_200_OK)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, project, alert_rule):
        try:
            delete_alert_rule(alert_rule, request.user)
            return Response(status=status.HTTP_204_NO_CONTENT)
        except AlreadyDeletedError:
            return Response(
                "This rule has already been deleted", status=status.HTTP_400_BAD_REQUEST
            )
