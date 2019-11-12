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


class OrganizationAlertRuleAvailableActionIndexEndpoint(OrganizationEndpoint):
    def build_action_response(self, registered_type, integration=None):
        return {
            "type": registered_type.slug,
            "allowedTargetTypes": [
                action_target_type_to_string[target_type]
                for target_type in registered_type.supported_target_types
            ],
            "integrationName": integration.name if integration else None,
            "integrationId": integration.id if integration else None,
        }

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
                    actions.append(self.build_action_response(registered_type, integration))
            else:
                actions.append(self.build_action_response(registered_type))

        return Response(actions, status=status.HTTP_200_OK)
