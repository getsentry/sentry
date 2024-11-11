from __future__ import annotations

from typing import Any

from django.db import router, transaction
from django.http import Http404
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import audit_log
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.api.serializers import serialize
from sentry.apidocs.constants import RESPONSE_NO_CONTENT, RESPONSE_NOT_FOUND
from sentry.apidocs.examples.integration_examples import IntegrationExamples
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.constants import ObjectStatus
from sentry.deletions.models.scheduleddeletion import ScheduledDeletion
from sentry.integrations.api.bases.organization_integrations import (
    OrganizationIntegrationBaseEndpoint,
)
from sentry.integrations.api.serializers.models.integration import (
    OrganizationIntegrationResponse,
    OrganizationIntegrationSerializer,
)
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.organizations.services.organization import RpcUserOrganizationContext
from sentry.shared_integrations.exceptions import ApiError, IntegrationError
from sentry.utils.audit import create_audit_entry
from sentry.web.decorators import set_referrer_policy


class IntegrationSerializer(serializers.Serializer):
    name = serializers.CharField(required=False)
    domain = serializers.URLField(required=False, allow_blank=True)


@control_silo_endpoint
@extend_schema(tags=["Integrations"])
class OrganizationIntegrationDetailsEndpoint(OrganizationIntegrationBaseEndpoint):
    owner = ApiOwner.INTEGRATIONS
    publish_status = {
        "DELETE": ApiPublishStatus.PUBLIC,
        "GET": ApiPublishStatus.PUBLIC,
        "POST": ApiPublishStatus.PRIVATE,
    }

    @extend_schema(
        operation_id="Retrieve an Integration for an Organization",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.INTEGRATION_ID,
        ],
        responses={
            200: inline_sentry_response_serializer(
                "OrganizationIntegrationResponse", OrganizationIntegrationResponse
            ),
        },
        examples=IntegrationExamples.GET_INTEGRATION,
    )
    @set_referrer_policy("strict-origin-when-cross-origin")
    @method_decorator(never_cache)
    def get(
        self,
        request: Request,
        organization_context: RpcUserOrganizationContext,
        integration_id: int,
        **kwds: Any,
    ) -> Response:
        org_integration = self.get_organization_integration(
            organization_context.organization.id, integration_id
        )

        return self.respond(
            serialize(
                org_integration, request.user, OrganizationIntegrationSerializer(params=request.GET)
            )
        )

    @extend_schema(
        operation_id="Delete an Integration for an Organization",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, GlobalParams.INTEGRATION_ID],
        responses={
            204: RESPONSE_NO_CONTENT,
            404: RESPONSE_NOT_FOUND,
        },
    )
    @set_referrer_policy("strict-origin-when-cross-origin")
    @method_decorator(never_cache)
    def delete(
        self,
        request: Request,
        organization_context: RpcUserOrganizationContext,
        integration_id: int,
        **kwds: Any,
    ) -> Response:
        # Removing the integration removes the organization
        # integrations and all linked issues.

        # NOTE(hybrid-cloud): Deletions require the ORM object, not API versions
        org_integration: OrganizationIntegration | None = OrganizationIntegration.objects.filter(
            integration_id=integration_id, organization_id=organization_context.organization.id
        ).first()
        if not org_integration:
            raise Http404
        integration = self.get_integration(organization_context.organization.id, integration_id)
        # do any integration specific deleting steps
        integration.get_installation(
            organization_id=organization_context.organization.id
        ).uninstall()

        with transaction.atomic(using=router.db_for_write(OrganizationIntegration)):
            updated = False
            for oi in OrganizationIntegration.objects.filter(
                id=org_integration.id, status=ObjectStatus.ACTIVE
            ):
                oi.update(status=ObjectStatus.PENDING_DELETION)
                updated = True

            if updated:
                ScheduledDeletion.schedule(org_integration, days=0, actor=request.user)
                create_audit_entry(
                    request=request,
                    organization_id=organization_context.organization.id,
                    target_object=integration.id,
                    event=audit_log.get_event_id("INTEGRATION_REMOVE"),
                    data={"provider": integration.provider, "name": integration.name},
                )

        return self.respond(status=204)

    @set_referrer_policy("strict-origin-when-cross-origin")
    @method_decorator(never_cache)
    def post(
        self,
        request: Request,
        organization_context: RpcUserOrganizationContext,
        integration_id: int,
        **kwds: Any,
    ) -> Response:
        integration = self.get_integration(organization_context.organization.id, integration_id)
        installation = integration.get_installation(
            organization_id=organization_context.organization.id
        )
        try:
            installation.update_organization_config(request.data)
        except (IntegrationError, ApiError) as e:
            return self.respond({"detail": [str(e)]}, status=400)

        return self.respond(status=200)
