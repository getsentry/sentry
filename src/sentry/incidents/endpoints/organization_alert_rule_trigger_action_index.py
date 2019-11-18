from __future__ import absolute_import

from rest_framework import status
from rest_framework.response import Response

from sentry import features
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.incidents.endpoints.bases import OrganizationAlertRuleTriggerEndpoint
from sentry.incidents.endpoints.serializers import AlertRuleTriggerActionSerializer
from sentry.incidents.logic import get_actions_for_trigger, InvalidTriggerActionError


class OrganizationAlertRuleTriggerActionIndexEndpoint(OrganizationAlertRuleTriggerEndpoint):
    def get(self, request, organization, alert_rule, alert_rule_trigger):
        """
        Fetches actions for a trigger
        """
        if not features.has("organizations:incidents", organization, actor=request.user):
            raise ResourceDoesNotExist

        return self.paginate(
            request,
            queryset=get_actions_for_trigger(alert_rule_trigger),
            order_by="type",
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(x, request.user),
            default_per_page=25,
        )

    def post(self, request, organization, alert_rule, alert_rule_trigger):
        """
        Create an action on a trigger
        """
        if not features.has("organizations:incidents", organization, actor=request.user):
            raise ResourceDoesNotExist

        serializer = AlertRuleTriggerActionSerializer(
            context={
                "organization": organization,
                "alert_rule": alert_rule,
                "trigger": alert_rule_trigger,
                "access": request.access,
            },
            data=request.data,
        )

        if serializer.is_valid():
            try:
                action = serializer.save()
            except InvalidTriggerActionError as e:
                return Response(e.message, status=status.HTTP_400_BAD_REQUEST)
            return Response(serialize(action, request.user), status=status.HTTP_201_CREATED)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
