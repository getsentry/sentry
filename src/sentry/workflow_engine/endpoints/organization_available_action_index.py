from collections import defaultdict
from typing import TypedDict

from drf_spectacular.utils import extend_schema

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import OrganizationEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.integrations.services.integration import RpcIntegration
from sentry.rules.actions.services import PluginService, SentryAppService
from sentry.sentry_apps.models.sentry_app_installation import prepare_ui_component
from sentry.sentry_apps.services.app import app_service
from sentry.workflow_engine.endpoints.serializers.action_handler_serializer import (
    ActionHandlerSerializer,
    ActionHandlerSerializerResponse,
)
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.processors.action import (
    get_available_action_integrations_for_org,
    get_integration_services,
    get_notification_plugins_for_org,
)
from sentry.workflow_engine.registry import action_handler_registry
from sentry.workflow_engine.types import ActionHandler


class AvailableIntegration(TypedDict):
    integration: RpcIntegration
    services: list[tuple[int, str]]


@region_silo_endpoint
class OrganizationAvailableActionIndexEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ISSUES

    @extend_schema(
        operation_id="Fetch Available Actions",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
        ],
        responses={
            201: inline_sentry_response_serializer(
                "ListAvailableActionResponse", list[ActionHandlerSerializerResponse]
            ),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(self, request, organization):
        """
        Returns a list of available actions for a given org
        """
        can_create_tickets = features.has("organizations:integrations-ticket-rules", organization)

        integration_services = get_integration_services(organization.id)

        provider_integrations: dict[str, list[AvailableIntegration]] = defaultdict(list)
        for integration in get_available_action_integrations_for_org(organization):
            services = integration_services.get(integration.id, [])
            provider_integrations[integration.provider].append(
                AvailableIntegration(integration=integration, services=services)
            )

        all_sentry_app_contexts = app_service.get_installation_component_contexts(
            filter={"organization_id": organization.id},
            component_type="alert-rule-action",
            include_contexts_without_component=True,
        )

        # filter for alertable apps and split contexts into those with and without components
        alertable_apps_with_components = []
        alertable_apps_without_components = []
        for context in all_sentry_app_contexts:
            if not context.installation.sentry_app.is_alertable:
                continue

            if context.component:
                # filter out broken apps by checking if prepare_ui_component succeeds
                prepared_component = prepare_ui_component(
                    installation=context.installation,
                    component=context.component,
                )
                if prepared_component is not None:
                    alertable_apps_with_components.append(context)
            else:
                alertable_apps_without_components.append(context)

        actions = []
        for action_type, handler in action_handler_registry.registrations.items():
            # skip ticket creation actions if organization doesn't have the feature
            if not can_create_tickets and handler.group == ActionHandler.Group.TICKET_CREATION:
                continue

            # add integration actions
            if hasattr(handler, "provider_slug"):
                integrations = provider_integrations.get(handler.provider_slug, [])
                if integrations:
                    actions.append(
                        serialize(
                            handler,
                            request.user,
                            ActionHandlerSerializer(),
                            action_type=action_type,
                            integrations=integrations,
                        )
                    )

            # add alertable sentry app actions
            # sentry app actions are only for alertable sentry apps with components
            elif action_type == Action.Type.SENTRY_APP:
                for context in alertable_apps_with_components:
                    actions.append(
                        serialize(
                            handler,
                            request.user,
                            ActionHandlerSerializer(),
                            action_type=action_type,
                            sentry_app_context=context,
                        )
                    )

            # add webhook action
            # service options include plugins and sentry apps without components
            elif action_type == Action.Type.WEBHOOK:
                plugins = get_notification_plugins_for_org(organization)
                sentry_apps: list[PluginService] = [
                    SentryAppService(context.installation.sentry_app)
                    for context in alertable_apps_without_components
                ]
                available_services: list[PluginService] = plugins + sentry_apps

                if available_services:
                    actions.append(
                        serialize(
                            handler,
                            request.user,
                            ActionHandlerSerializer(),
                            action_type=action_type,
                            services=available_services,
                        )
                    )

            # add all other action types (EMAIL, PLUGIN, etc.)
            else:
                actions.append(
                    serialize(
                        handler, request.user, ActionHandlerSerializer(), action_type=action_type
                    )
                )

        actions.sort(
            key=lambda x: (
                x["handlerGroup"],
                (
                    0
                    if x["type"] in [Action.Type.EMAIL, Action.Type.PLUGIN, Action.Type.WEBHOOK]
                    else 1
                ),
                x["type"],
                (x["sentryApp"].get("name", "") if x.get("sentryApp") else ""),
            )
        )

        return self.paginate(
            request=request,
            queryset=actions,
            paginator_cls=OffsetPaginator,
        )
