from collections import defaultdict

from drf_spectacular.utils import extend_schema

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
from sentry.constants import ObjectStatus
from sentry.integrations.services.integration import RpcIntegration, integration_service
from sentry.models.organization import Organization
from sentry.sentry_apps.services.app import app_service
from sentry.workflow_engine.endpoints.serializers import (
    ActionHandlerSerializer,
    ActionHandlerSerializerResponse,
)
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.registry import action_handler_registry


def get_available_action_integrations_for_org(organization: Organization) -> list[RpcIntegration]:
    """
    Returns a list of integrations that the organization has installed. Integrations are
    filtered by the list of registered providers.
    :param organization:
    """

    providers = [
        handler.provider_slug
        for handler in action_handler_registry.registrations.values()
        if hasattr(handler, "provider_slug")
    ]
    return integration_service.get_integrations(
        status=ObjectStatus.ACTIVE,
        org_integration_status=ObjectStatus.ACTIVE,
        organization_id=organization.id,
        providers=providers,
    )


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
        provider_integrations: dict[str, list[RpcIntegration]] = defaultdict(list)
        for integration in get_available_action_integrations_for_org(organization):
            provider_integrations[integration.provider].append(integration)

        sentry_app_component_contexts = app_service.get_installation_component_contexts(
            filter={"organization_id": organization.id},
            component_type="alert-rule-action",
            include_contexts_without_component=True,
        )

        actions = []
        for action_type, handler in action_handler_registry.registrations.items():
            # add integration actions
            if hasattr(handler, "provider_slug"):
                integrations = provider_integrations.get(handler.provider_slug, [])
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
            elif action_type == Action.Type.SENTRY_APP:
                for context in sentry_app_component_contexts:
                    if context.installation.sentry_app.is_alertable:
                        actions.append(
                            serialize(
                                handler,
                                request.user,
                                ActionHandlerSerializer(),
                                action_type=action_type,
                                sentry_app_context=context,
                            )
                        )

            # TODO(mia): handle adding webhoook actions
            elif action_type == Action.Type.WEBHOOK:
                continue

            # add all other actions
            else:
                actions.append(
                    serialize(
                        handler, request.user, ActionHandlerSerializer(), action_type=action_type
                    )
                )

        return self.paginate(
            request=request,
            queryset=actions,
            paginator_cls=OffsetPaginator,
        )
