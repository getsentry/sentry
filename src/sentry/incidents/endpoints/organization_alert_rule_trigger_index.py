from __future__ import absolute_import

from rest_framework import status
from rest_framework.response import Response

from sentry import features
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.incidents.endpoints.bases import OrganizationAlertRuleEndpoint
from sentry.incidents.endpoints.serializers import AlertRuleTriggerSerializer
from sentry.incidents.logic import get_triggers_for_alert_rule


class OrganizationAlertRuleTriggerIndexEndpoint(OrganizationAlertRuleEndpoint):
    def get(self, request, organization, alert_rule):
        """
        Fetches triggers for an alert_rule
        """
        if not features.has("organizations:incidents", organization, actor=request.user):
            raise ResourceDoesNotExist

        return self.paginate(
            request,
            queryset=get_triggers_for_alert_rule(alert_rule),
            order_by="-label",
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(x, request.user),
            default_per_page=25,
        )

    def post(self, request, organization, alert_rule):
        """
        Create a trigger on an alert rule
        """
        if not features.has("organizations:incidents", organization, actor=request.user):
            raise ResourceDoesNotExist

        serializer = AlertRuleTriggerSerializer(
            context={
                "organization": organization,
                "alert_rule": alert_rule,
                "access": request.access,
            },
            data=request.data,
        )

        if serializer.is_valid():
            trigger = serializer.save()
            return Response(serialize(trigger, request.user), status=status.HTTP_201_CREATED)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
