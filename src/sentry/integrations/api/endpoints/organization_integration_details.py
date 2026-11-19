from __future__ import annotations

import logging
from typing import Any

import sentry_sdk
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
from sentry.apidocs.constants import RESPONSE_BAD_REQUEST, RESPONSE_NO_CONTENT, RESPONSE_NOT_FOUND
from sentry.apidocs.examples.integration_examples import IntegrationExamples
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.response_types import DetailResponse
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.auth.exceptions import IdentityNotValid
from sentry.constants import ObjectStatus
from sentry.deletions.models.scheduleddeletion import ScheduledDeletion
from sentry.exceptions import InvalidIdentity
from sentry.integrations.api.bases.organization_integrations import (
    OrganizationIntegrationBaseEndpoint,
)
from sentry.integrations.api.serializers.models.integration import (
    OrganizationIntegrationResponse,
    OrganizationIntegrationSerializer,
)
from sentry.integrations.mixins.issues import IssueBasicIntegration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.services.integration import integration_service
from sentry.organizations.services.organization import RpcUserOrganizationContext
from sentry.shared_integrations.exceptions import ApiError, IntegrationError
from sentry.users.models.identity import Identity
from sentry.utils.audit import create_audit_entry
from sentry.web.decorators import set_referrer_policy

logger = logging.getLogger(__name__)


class IntegrationSerializer(serializers.Serializer):
    name = serializers.CharField(required=False)
    domain = serializers.URLField(required=False, allow_blank=True)


@control_silo_endpoint
@extend_schema(tags=["Integrations"])
class OrganizationIntegrationDetailsEndpoint(OrganizationIntegrationBaseEndpoint):
    owner = ApiOwner.INTEGRATION_PLATFORM
    publish_status = {
        "DELETE": ApiPublishStatus.PUBLIC,
        "GET": ApiPublishStatus.PUBLIC,
        "POST": ApiPublishStatus.PRIVATE,
    }
    idempotent_methods = frozenset()

    @extend_schema(
        operation_id="getOrganizationIntegration",
        summary="Retrieve an Integration for an Organization",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.INTEGRATION_ID,
        ],
        responses={
            200: inline_sentry_response_serializer(
                "OrganizationIntegrationResponse", OrganizationIntegrationResponse
            ),
            400: RESPONSE_BAD_REQUEST,
            404: RESPONSE_NOT_FOUND,
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
    ) -> Response[OrganizationIntegrationResponse] | Response[DetailResponse]:
        organization = organization_context.organization
        org_integration = self.get_organization_integration(organization.id, integration_id)

        if request.GET.get("action") == "create":
            # Fetch the ticket form here rather than in the serializer, which swallows
            # errors, so TicketRuleModal can show why the provider failed.
            integration = integration_service.get_integration(
                integration_id=org_integration.integration_id
            )
            if integration is None:
                return Response({"detail": "Integration not found."}, status=404)
            installation = integration.get_installation(organization_id=organization.id)
            if not isinstance(installation, IssueBasicIntegration):
                return Response(
                    {"detail": "This integration doesn't support creating issues."}, status=400
                )
            installation.organization = organization
            try:
                create_issue_config = installation.get_create_issue_config(
                    None, request.user, params=request.GET
                )
            except IntegrationError as e:
                return Response({"detail": str(e)}, status=400)
            except (ApiError, IdentityNotValid, InvalidIdentity, Identity.DoesNotExist) as e:
                # ApiError text is the raw provider response, so don't show it.
                logger.info(
                    "organization_integration.create_issue_config_failed",
                    extra={
                        "integration_id": integration.id,
                        "integration_provider": integration.provider,
                        "error_type": type(e).__name__,
                    },
                )
                return Response(
                    {
                        "detail": "Couldn't load the issue form from this integration. "
                        "Check that it's still connected, then try again."
                    },
                    status=400,
                )

            # include_config=False skips the provider calls; the form was fetched above.
            serialized = serialize(
                org_integration,
                request.user,
                OrganizationIntegrationSerializer(params=request.GET),
                include_config=False,
            )
            return self.respond(
                {**serialized, "configOrganization": [], "createIssueConfig": create_issue_config}
            )

        return self.respond(
            serialize(
                org_integration, request.user, OrganizationIntegrationSerializer(params=request.GET)
            )
        )

    @extend_schema(
        operation_id="deleteOrganizationIntegration",
        summary="Delete an Integration for an Organization",
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
    ) -> Response[None]:
        # Removing the integration removes the organization
        # integrations and all linked issues.

        # NOTE(hybrid-cloud): Deletions require the ORM object, not API versions
        org_integration: OrganizationIntegration | None = (
            OrganizationIntegration.objects.get_or_none(
                integration_id=integration_id, organization_id=organization_context.organization.id
            )
        )
        if not org_integration:
            raise Http404
        # A repeated DELETE must not uninstall again. Uninstall hooks that skip
        # pending rows when counting installs (Discord, Cursor Origin) would see
        # another org as the last one and tear down the install it still uses.
        if org_integration.status in (
            ObjectStatus.PENDING_DELETION,
            ObjectStatus.DELETION_IN_PROGRESS,
        ):
            return self.respond(status=204)
        integration = self.get_integration(organization_context.organization.id, integration_id)
        # do any integration specific deleting steps
        integration.get_installation(
            organization_id=organization_context.organization.id
        ).uninstall()

        with transaction.atomic(using=router.db_for_write(OrganizationIntegration)):
            updated = False
            for oi in OrganizationIntegration.objects.filter(
                id=org_integration.id, status__in=[ObjectStatus.ACTIVE, ObjectStatus.DISABLED]
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
        organization = organization_context.organization

        integration = self.get_integration(organization.id, integration_id)
        installation = integration.get_installation(organization_id=organization.id)
        try:
            extra_audit_data = installation.update_organization_config(request.data) or {}
        except (IntegrationError, ApiError) as e:
            sentry_sdk.capture_exception(e)
            return self.respond({"detail": str(e)}, status=400)

        self.create_audit_entry(
            request=request,
            organization=organization,
            target_object=integration.id,
            event=audit_log.get_event_id("INTEGRATION_EDIT"),
            data={"provider": integration.provider, "name": "config"},
        )

        # `INTEGRATION_EDIT` only records that "config" changed. Project status mappings own
        # rows of their own, so record what was added and removed under a dedicated event.
        project_mapping_changes = extra_audit_data.get("sync_status_forward")
        if project_mapping_changes:
            self.create_audit_entry(
                request=request,
                organization=organization,
                target_object=integration.id,
                event=audit_log.get_event_id("INTEGRATION_PROJECT_MAPPINGS_UPDATE"),
                data={"provider": integration.provider, **project_mapping_changes},
            )

        return self.respond(status=200)
