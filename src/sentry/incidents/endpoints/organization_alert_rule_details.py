from rest_framework import status
from rest_framework.response import Response

from sentry.api.serializers import serialize
from sentry.api.serializers.models.alert_rule import DetailedAlertRuleSerializer
from sentry.auth.superuser import is_active_superuser
from sentry.incidents.endpoints.bases import OrganizationAlertRuleEndpoint
from sentry.incidents.endpoints.serializers import AlertRuleSerializer as DrfAlertRuleSerializer
from sentry.incidents.logic import AlreadyDeletedError, delete_alert_rule
from sentry.models import OrganizationMemberTeam
from sentry.models.actor import ACTOR_TYPES


class OrganizationAlertRuleDetailsEndpoint(OrganizationAlertRuleEndpoint):
    def get(self, request, organization, alert_rule):
        """
        Fetch an alert rule.
        ``````````````````
        :auth: required
        """
        data = serialize(alert_rule, request.user, DetailedAlertRuleSerializer())
        return Response(data)

    def put(self, request, organization, alert_rule):
        serializer = DrfAlertRuleSerializer(
            context={"organization": organization, "access": request.access},
            instance=alert_rule,
            data=request.data,
        )

        if serializer.is_valid():
            if not self._verify_user_has_permission(request, alert_rule):
                return Response(
                    {
                        "detail": [
                            "You do not have permission to edit this alert rule because you are not a member of the assigned team."
                        ]
                    },
                    status=403,
                )
            alert_rule = serializer.save()
            return Response(serialize(alert_rule, request.user), status=status.HTTP_200_OK)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, organization, alert_rule):
        if not self._verify_user_has_permission(request, alert_rule):
            return Response(
                {
                    "detail": [
                        "You do not have permission to delete this alert rule because you are not a member of the assigned team."
                    ]
                },
                status=403,
            )
        try:
            delete_alert_rule(alert_rule)
            return Response(status=status.HTTP_204_NO_CONTENT)
        except AlreadyDeletedError:
            return Response(
                "This rule has already been deleted", status=status.HTTP_400_BAD_REQUEST
            )

    def _verify_user_has_permission(self, request, alert_rule):
        if not is_active_superuser(request):
            if alert_rule.owner and alert_rule.owner.type == ACTOR_TYPES["team"]:
                team = alert_rule.owner.resolve()
                if not OrganizationMemberTeam.objects.filter(
                    organizationmember__user=request.user, team=team, is_active=True
                ).exists():
                    return False
        return True
