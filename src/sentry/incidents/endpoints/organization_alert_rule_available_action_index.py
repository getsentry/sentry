from __future__ import absolute_import

from collections import defaultdict

from rest_framework import status
from rest_framework.response import Response

from sentry import features
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.incidents.endpoints.bases import OrganizationEndpoint
from sentry.incidents.endpoints.serializers import action_target_type_to_string
from sentry.incidents.logic import get_available_action_integrations_for_org
from sentry.incidents.models import AlertRuleTriggerAction
from sentry.models import OrganizationIntegration, PagerDutyService


class OrganizationAlertRuleAvailableActionIndexEndpoint(OrganizationEndpoint):
    def fetch_services(self, organization, integration_id):
        services = PagerDutyService.objects.filter(
            organization_integration=OrganizationIntegration.objects.get(
                organization=organization, integration=integration_id
            )
        )
        formatted_services = [
            {"value": service.id, "label": service.service_name} for service in services
        ]
        return formatted_services

    def build_action_response(self, organization, registered_type, integration=None):
        allowed_target_types = [
            action_target_type_to_string[target_type]
            for target_type in registered_type.supported_target_types
        ]
        input_type = ""
        if "specific" in allowed_target_types:
            input_type = "select" if registered_type.slug == "pagerduty" else "text"

        action_response = {
            "type": registered_type.slug,
            "allowedTargetTypes": allowed_target_types,
            "integrationName": integration.name if integration else None,
            "integrationId": integration.id if integration else None,
            "inputType": input_type,
        }

        if input_type == "select":
            if integration and registered_type.slug == "pagerduty":
                action_response["options"] = self.fetch_services(organization, integration.id)
        return action_response

    def get(self, request, organization):
        """
        Fetches actions that an alert rule can perform for an organization
        """
        if not features.has("organizations:incidents", organization, actor=request.user):
            raise ResourceDoesNotExist

        actions = []

        integrations = get_available_action_integrations_for_org(organization).order_by("id")
        provider_integrations = defaultdict(list)
        for integration in integrations:
            provider_integrations[integration.provider].append(integration)
        registered_types = AlertRuleTriggerAction.get_registered_types()
        registered_types.sort(key=lambda x: x.slug)

        for registered_type in AlertRuleTriggerAction.get_registered_types():
            if registered_type.integration_provider:
                for integration in provider_integrations[registered_type.integration_provider]:
                    actions.append(
                        self.build_action_response(organization, registered_type, integration)
                    )
            else:
                actions.append(self.build_action_response(organization, registered_type))
        return Response(actions, status=status.HTTP_200_OK)
