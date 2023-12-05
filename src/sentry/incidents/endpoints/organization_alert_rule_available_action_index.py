from __future__ import annotations

from collections import defaultdict
from typing import Any, DefaultDict, List, Mapping

from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.incidents.logic import (
    get_available_action_integrations_for_org,
    get_opsgenie_teams,
    get_pagerduty_services,
)
from sentry.incidents.models import AlertRuleTriggerAction
from sentry.incidents.serializers import ACTION_TARGET_TYPE_TO_STRING
from sentry.models.organization import Organization
from sentry.services.hybrid_cloud.app import RpcSentryAppInstallation, app_service
from sentry.services.hybrid_cloud.integration import RpcIntegration


def build_action_response(
    registered_type,
    integration: RpcIntegration | None = None,
    organization: Organization | None = None,
    sentry_app_installation: RpcSentryAppInstallation | None = None,
) -> Mapping[str, Any]:
    """
    Build the "available action" objects for the API. Each one can have different fields.

    :param registered_type: One of the registered AlertRuleTriggerAction types.
    :param integration: Optional. The Integration if this action uses a one.
    :param organization: Optional. If this is a PagerDuty/Opsgenie action, we need the organization to look up services/teams.
    :param sentry_app: Optional. The SentryApp if this action uses a one.
    :return: The available action object.
    """
    action_response = {
        "type": registered_type.slug,
        "allowedTargetTypes": [
            ACTION_TARGET_TYPE_TO_STRING.get(target_type)
            for target_type in registered_type.supported_target_types
        ],
    }

    if integration:
        action_response["integrationName"] = integration.name
        action_response["integrationId"] = integration.id

        if registered_type.type == AlertRuleTriggerAction.Type.PAGERDUTY:
            if organization is None:
                raise Exception("Organization is required for PAGERDUTY actions")
            action_response["options"] = [
                {"value": id, "label": service_name}
                for id, service_name in get_pagerduty_services(organization.id, integration.id)
            ]
        elif registered_type.type == AlertRuleTriggerAction.Type.OPSGENIE:
            if organization is None:
                raise Exception("Organization is required for OPSGENIE actions")
            action_response["options"] = [
                {"value": id, "label": team}
                for id, team in get_opsgenie_teams(organization.id, integration.id)
            ]

    elif sentry_app_installation:
        action_response["sentryAppName"] = sentry_app_installation.sentry_app.name
        action_response["sentryAppId"] = sentry_app_installation.sentry_app.id
        action_response["sentryAppInstallationUuid"] = sentry_app_installation.uuid
        action_response["status"] = sentry_app_installation.sentry_app.status

        # Sentry Apps can be alertable but not have an Alert Rule UI Component
        component = app_service.prepare_sentry_app_components(
            installation_id=sentry_app_installation.id, component_type="alert-rule-action"
        )
        if component:
            action_response["settings"] = component.app_schema.get("settings", {})

    return action_response


@region_silo_endpoint
class OrganizationAlertRuleAvailableActionIndexEndpoint(OrganizationEndpoint):
    owner = ApiOwner.ISSUES
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
    }

    def get(self, request: Request, organization) -> Response:
        """
        Fetches actions that an alert rule can perform for an organization
        """
        if not features.has("organizations:incidents", organization, actor=request.user):
            raise ResourceDoesNotExist

        actions = []

        # Cache Integration objects in this data structure to save DB calls.
        provider_integrations: DefaultDict[str, List[RpcIntegration]] = defaultdict(list)
        for integration in get_available_action_integrations_for_org(organization):
            provider_integrations[integration.provider].append(integration)

        for registered_type in AlertRuleTriggerAction.get_registered_types():
            # Used cached integrations for each `registered_type` instead of making N calls.
            if registered_type.integration_provider:
                actions += [
                    build_action_response(
                        registered_type, integration=integration, organization=organization
                    )
                    for integration in provider_integrations[registered_type.integration_provider]
                ]

            # Add all alertable SentryApps to the list.
            elif registered_type.type == AlertRuleTriggerAction.Type.SENTRY_APP:
                installs = app_service.get_installed_for_organization(
                    organization_id=organization.id
                )
                actions += [
                    build_action_response(registered_type, sentry_app_installation=install)
                    for install in installs
                    if install.sentry_app.is_alertable
                ]

            else:
                actions.append(build_action_response(registered_type))
        return Response(actions, status=status.HTTP_200_OK)
