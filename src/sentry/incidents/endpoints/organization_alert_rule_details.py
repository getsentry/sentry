from django.db.models import Q
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import region_silo_endpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.models.alert_rule import DetailedAlertRuleSerializer
from sentry.incidents.endpoints.bases import OrganizationAlertRuleEndpoint
from sentry.incidents.logic import (
    AlreadyDeletedError,
    delete_alert_rule,
    get_slack_actions_with_async_lookups,
)
from sentry.incidents.serializers import AlertRuleSerializer as DrfAlertRuleSerializer
from sentry.incidents.utils.sentry_apps import trigger_sentry_app_action_creators_for_incidents
from sentry.integrations.slack.utils import RedisRuleStatus
from sentry.models import SentryAppComponent, SentryAppInstallation
from sentry.models.rulesnooze import RuleSnooze
from sentry.services.hybrid_cloud.app import app_service
from sentry.services.hybrid_cloud.user.service import user_service
from sentry.tasks.integrations.slack import find_channel_id_for_alert_rule


def fetch_alert_rule(request: Request, organization, alert_rule):
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
                installation = SentryAppInstallation(**action.get("_sentry_app_installation", {}))
                component = installation.prepare_ui_component(
                    SentryAppComponent(**action.get("_sentry_app_component")),
                    None,
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

    if len(errors):
        serialized_rule["errors"] = errors

    rule_snooze = RuleSnooze.objects.filter(
        Q(user_id=request.user.id) | Q(user_id=None), alert_rule=alert_rule
    ).first()
    if rule_snooze:
        serialized_rule["snooze"] = True
        if request.user.id == rule_snooze.owner_id:
            serialized_rule["snoozeCreatedBy"] = "You"
        else:
            user = user_service.get_user(rule_snooze.owner_id)
            if user:
                serialized_rule["snoozeCreatedBy"] = user.get_display_name()
        serialized_rule["snoozeForEveryone"] = rule_snooze.user_id is None

    return Response(serialized_rule)


def update_alert_rule(request: Request, organization, alert_rule):
    data = request.data
    serializer = DrfAlertRuleSerializer(
        context={
            "organization": organization,
            "access": request.access,
            "user": request.user,
            "ip_address": request.META.get("REMOTE_ADDR"),
            "installations": app_service.get_installed_for_organization(
                organization_id=organization.id
            ),
        },
        instance=alert_rule,
        data=data,
        # partial=True, # TODO look up what this does. I copied it over because the project one had it
    )

    if serializer.is_valid():
        trigger_sentry_app_action_creators_for_incidents(serializer.validated_data)
        if get_slack_actions_with_async_lookups(organization, request.user, data):
            # need to kick off an async job for Slack
            client = RedisRuleStatus()
            task_args = {
                "organization_id": organization.id,
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


def remove_alert_rule(request: Request, organization, alert_rule):
    try:
        delete_alert_rule(alert_rule, user=request.user, ip_address=request.META.get("REMOTE_ADDR"))
        return Response(status=status.HTTP_204_NO_CONTENT)
    except AlreadyDeletedError:
        return Response("This rule has already been deleted", status=status.HTTP_400_BAD_REQUEST)


@region_silo_endpoint
class OrganizationAlertRuleDetailsEndpoint(OrganizationAlertRuleEndpoint):
    def get(self, request: Request, organization, alert_rule) -> Response:
        """
        Fetch an alert rule.
        ``````````````````
        :auth: required
        """
        return fetch_alert_rule(request, organization, alert_rule)

    def put(self, request: Request, organization, alert_rule) -> Response:
        return update_alert_rule(request, organization, alert_rule)

    def delete(self, request: Request, organization, alert_rule) -> Response:
        return remove_alert_rule(request, organization, alert_rule)
