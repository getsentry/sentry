from __future__ import absolute_import

from copy import deepcopy

from rest_framework import status
from rest_framework.response import Response

from sentry import features
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.incidents.models import AlertRule
from sentry.incidents.endpoints.serializers import (
    AlertRuleSerializer,
    AlertRuleTriggerSerializer,
    AlertRuleTriggerActionSerializer,
)
from sentry.incidents.logic import (
    # create_alert_rule,
    # create_alert_rule_trigger,
    # create_alert_rule_trigger_action,
    InvalidTriggerActionError,
)


class OrganizationAlertRuleIndexEndpoint(OrganizationEndpoint):
    def get(self, request, organization):
        """
        Fetches alert rules for an organization
        """
        if not features.has("organizations:incidents", organization, actor=request.user):
            raise ResourceDoesNotExist

        return self.paginate(
            request,
            queryset=AlertRule.objects.fetch_for_organization(organization),
            order_by="-date_added",
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(x, request.user),
            default_per_page=25,
        )

    def post(self, request, organization):
        """
        Create an alert rule
        """
        # TODO: Can save all created objects in a list for a rollback in case there are any errors. Just pass list to rollback function.
        # TODO: Use create_alert_rule, create_alert_rule_trigger, and create_alert_rule_trigger_action?
        if not features.has("organizations:incidents", organization, actor=request.user):
            raise ResourceDoesNotExist

        data = deepcopy(request.data)
        # TODO: Possibly before creating the rule, or sometime - ensure at least one trigger is defined. Also ensure that each trigger has at least one action.
        # If two triggers, ensure threshold constraints (warning triggers & resolves before critical)

        alert_rule_serializer = AlertRuleSerializer(
            context={"organization": organization, "access": request.access}, data=data
        )
        if alert_rule_serializer.is_valid():
            alert_rule = alert_rule_serializer.save()
        else:
            return Response(
                {
                    "AlertRuleError": alert_rule_serializer.errors,
                    "message": "Could not create AlertRule",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        triggers = data.get("triggers", [])
        for trigger in triggers:
            # TODO: Implement trigger constraints for thresholds (warning triggers & resolves before critical)
            trigger_serializer = AlertRuleTriggerSerializer(
                context={
                    "organization": organization,
                    "alert_rule": alert_rule,
                    "access": request.access,
                },
                data=trigger,
            )
            if trigger_serializer.is_valid():
                trigger_obj = trigger_serializer.save()
            else:
                # Could not create alert rule trigger.
                # TODO: ROLL BACK ALERT_RULE CREATION (and trigger if any yet). DELETE IT?
                return Response(
                    {
                        "AlertRuleTriggerError": trigger_serializer.errors,
                        "message": "Could not create AlertRuleTrigger",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            actions = trigger.get("actions", [])
            for action in actions:
                action_serializer = AlertRuleTriggerActionSerializer(
                    context={
                        "organization": organization,
                        "alert_rule": alert_rule,
                        "trigger": trigger_obj,
                        "access": request.access,
                    },
                    data=action,
                )

                if action_serializer.is_valid():
                    try:
                        action = action_serializer.save()
                    except InvalidTriggerActionError as e:
                        # Could not create a trigger action
                        # TODO: ROLL BACK ALL CREATIONS (Trigger(s), action(s) if any, and the alert rule)
                        return Response(e.message, status=status.HTTP_400_BAD_REQUEST)

        # If we get here, the alert rule, triggers, and actions all created successfully. So return that.
        return Response(serialize(alert_rule, request.user), status=status.HTTP_201_CREATED)
