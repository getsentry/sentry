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
from sentry.incidents.logic import create_alert_rule_unified
from sentry.incidents.endpoints.serializers import UnifiedAlertRuleSerializer

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

        if not features.has("organizations:incidents", organization, actor=request.user):
            raise ResourceDoesNotExist

        print("Instantiating serializer")
        serializer = UnifiedAlertRuleSerializer(
            context={
                "organization": organization,
                "access": request.access,
            },
            data=request.data,
        )
        print("Done. Serializer:", serializer)

        if serializer.is_valid():
            print("It's valid. Saving and returning.")
            trigger = serializer.save()
            print("trigger is:",trigger)
            return Response(serialize(trigger, request.user), status=status.HTTP_201_CREATED)

        print("Returning errors. Serializer invalid.")
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


        # if not features.has("organizations:incidents", organization, actor=request.user):
        #     raise ResourceDoesNotExist

        # data = request.data

        # alert_rule = create_alert_rule_unified(
        #     data, organization=organization, access=request.access
        # )

        # if alert_rule.get("error", False) is True:
        #     return Response(serialize(alert_rule, request.user), status=status.HTTP_400_BAD_REQUEST)
        # else:
        #     return Response(
        #         serialize(alert_rule["rule"], request.user), status=status.HTTP_201_CREATED
        #     )
