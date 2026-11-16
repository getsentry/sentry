import logging

from django.db import router, transaction
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import audit_log
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.api.bases.organization import (
    ControlSiloOrganizationEndpoint,
    OrganizationAdminPermission,
)
from sentry.api.serializers import serialize
from sentry.hybridcloud.models.outbox import OutboxDatabaseError, OutboxFlushError, outbox_context
from sentry.models.apikey import ApiKey
from sentry.organizations.services.organization.model import (
    RpcOrganization,
    RpcUserOrganizationContext,
)

logger = logging.getLogger(__name__)

DEFAULT_SCOPES = ["project:read", "event:read", "team:read", "org:read", "member:read"]


@control_silo_endpoint
class OrganizationApiKeyIndexEndpoint(ControlSiloOrganizationEndpoint):
    owner = ApiOwner.FOUNDATIONS
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "POST": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (OrganizationAdminPermission,)
    # Keys show their secret and take any scope, so a service account could exceed its own.
    requires_user = True

    def get(
        self,
        request: Request,
        organization_context: RpcUserOrganizationContext,
        organization: RpcOrganization,
    ) -> Response:
        """
        List an Organization's API Keys
        ```````````````````````````````````

        :pparam string organization_id_or_slug: the id or slug of the organization
        :auth: required
        """
        queryset = sorted(
            ApiKey.objects.filter(organization_id=organization.id), key=lambda x: x.label
        )

        return Response(serialize(queryset, request.user))

    def post(
        self,
        request: Request,
        organization_context: RpcUserOrganizationContext,
        organization: RpcOrganization,
    ) -> Response:
        """
        Create an Organization API Key
        ```````````````````````````````````

        :pparam string organization_id_or_slug: the id or slug of the organization
        :auth: required
        """
        key: ApiKey | None = None
        try:
            # This transaction is required to bind the key to a variable
            # when replication fails. The outbox_context is just to flag
            # that this is an outbox-producing operation.
            with outbox_context(transaction.atomic(router.db_for_write(ApiKey))):
                key = ApiKey.objects.create(
                    organization_id=organization.id, scope_list=DEFAULT_SCOPES
                )
        except (OutboxDatabaseError, OutboxFlushError):
            if key is None:
                raise

            # Guard against replication fanout failures. The key has been
            # minted, and its outbox has been committed alongside it,
            # guaranteeing that it will eventually be valid in all regions.
            logger.warning(
                "organization_api_key.outbox-flush-failure",
                extra={"api_key_id": key.id, "organization_id": organization.id},
                exc_info=True,
            )

        self.create_audit_entry(
            request,
            organization=organization,
            target_object=key.id,
            event=audit_log.get_event_id("APIKEY_ADD"),
            data=key.get_audit_log_data(),
        )

        return Response(serialize(key, request.user), status=status.HTTP_201_CREATED)
