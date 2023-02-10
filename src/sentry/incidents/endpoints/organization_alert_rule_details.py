from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import region_silo_endpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.models.alert_rule import DetailedAlertRuleSerializer
from sentry.auth.superuser import is_active_superuser
from sentry.incidents.endpoints.bases import OrganizationAlertRuleEndpoint
from sentry.incidents.logic import AlreadyDeletedError, delete_alert_rule
from sentry.incidents.serializers import AlertRuleSerializer as DrfAlertRuleSerializer
from sentry.models import OrganizationMemberTeam, SentryAppComponent, SentryAppInstallation
from sentry.models.actor import ACTOR_TYPES


@region_silo_endpoint
class OrganizationAlertRuleDetailsEndpoint(OrganizationAlertRuleEndpoint):
    def get(self, request: Request, organization, alert_rule) -> Response:
        """
        Fetch an alert rule.
        ``````````````````
        :auth: required
        """
        # Serialize Alert Rule
        expand = request.GET.getlist("expand", [])
        serialized_rule = serialize(
            alert_rule, request.user, DetailedAlertRuleSerializer(expand=expand)
        )

        # Prepare AlertRuleTriggerActions that are SentryApp components
        errors = []
        for trigger in serialized_rule.get("triggers", []):
            for action in trigger.get("actions", []):
                if action.get("_sentry_app_installation") and action.get("_sentry_app_component"):
                    installation = SentryAppInstallation(
                        **action.get("_sentry_app_installation", {})
                    )
                    component = installation.prepare_ui_component(
                        SentryAppComponent(**action.get("_sentry_app_component")),
                        None,
                        action.get("settings"),
                    )
                    if component is None:
                        errors.append(
                            {
                                "detail": f"Could not fetch details from {installation.sentry_app.name}"
                            }
                        )
                        action["disabled"] = True
                        continue

                    action["formFields"] = component.schema.get("settings", {})

                    # Delete meta fields
                    del action["_sentry_app_installation"]
                    del action["_sentry_app_component"]

        if len(errors):
            serialized_rule["errors"] = errors

        return Response(serialized_rule)

    def put(self, request: Request, organization, alert_rule) -> Response:
        serializer = DrfAlertRuleSerializer(
            context={
                "organization": organization,
                "access": request.access,
                "user": request.user,
                "ip_address": request.META.get("REMOTE_ADDR"),
            },
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

    def delete(self, request: Request, organization, alert_rule) -> Response:
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
            delete_alert_rule(
                alert_rule, user=request.user, ip_address=request.META.get("REMOTE_ADDR")
            )
            return Response(status=status.HTTP_204_NO_CONTENT)
        except AlreadyDeletedError:
            return Response(
                "This rule has already been deleted", status=status.HTTP_400_BAD_REQUEST
            )

    def _verify_user_has_permission(self, request: Request, alert_rule):
        if not is_active_superuser(request):
            if alert_rule.owner and alert_rule.owner.type == ACTOR_TYPES["team"]:
                team = alert_rule.owner.resolve()
                if not OrganizationMemberTeam.objects.filter(
                    organizationmember__user_id=request.user.id, team=team, is_active=True
                ).exists():
                    return False
        return True
