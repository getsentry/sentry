from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any

import orjson
from django.http.response import HttpResponseBase

from sentry.hybridcloud.outbox.category import WebhookProviderIdentifier
from sentry.integrations.gitea.webhooks import GiteaWebhookEndpoint
from sentry.integrations.middleware.hybrid_cloud.parser import BaseRequestParser
from sentry.integrations.models.integration import Integration
from sentry.integrations.types import IntegrationProviderSlug
from sentry.integrations.utils.scope import clear_organization_info
from sentry.models.organizationmapping import OrganizationMapping
from sentry.silo.base import control_silo_function
from sentry.types.cell import Cell, CellResolutionError, get_cell_by_name
from sentry.utils import metrics

logger = logging.getLogger(__name__)


class GiteaRequestParser(BaseRequestParser):
    provider = IntegrationProviderSlug.GITEA.value
    webhook_identifier = WebhookProviderIdentifier.GITEA
    _integration: Integration | None = None
    _METRIC_CONTROL_PATH_FAILURE_KEY = "integrations.gitea.get_integration_from_request.failure"

    def _resolve_cell(self) -> Cell | None:
        """
        The hook URL names the organization, so the cell comes straight from its
        mapping - no integration lookup and no fan-out to every organization
        sharing the ``Integration`` row.

        ``self.match`` is the parser's own URL resolution; the middleware runs
        before Django populates ``request.resolver_match``.
        """
        organization_id = self.match.kwargs.get("organization_id")
        logging_extra: dict[str, Any] = {"path": self.request.path}
        if not organization_id:
            logger.info("%s.no_organization_id", self.provider, extra=logging_extra)
            return None

        try:
            # A non-numeric id raises ValueError rather than DoesNotExist, so
            # both have to be caught.
            mapping = OrganizationMapping.objects.get(organization_id=organization_id)
        except (OrganizationMapping.DoesNotExist, ValueError) as e:
            logging_extra["error"] = str(e)
            logging_extra["organization_id"] = organization_id
            logger.info("%s.no_mapping", self.provider, extra=logging_extra)
            return None

        try:
            return get_cell_by_name(mapping.cell_name)
        except CellResolutionError as e:
            logging_extra["error"] = str(e)
            logging_extra["mapping_id"] = mapping.id
            logger.info("%s.no_cell", self.provider, extra=logging_extra)
            return None

    @control_silo_function
    def get_integration_from_request(self) -> Integration | None:
        """
        Resolved by primary key, straight off the URL.

        Only needed because Gitea shards its mailboxes per repository, and
        ``get_mailbox_identifier`` wants the integration object.
        """
        if self._integration:
            return self._integration
        if not self.is_json_request():
            return None
        try:
            integration_id = self.match.kwargs.get("integration_id")
            if integration_id:
                self._integration = Integration.objects.filter(
                    id=integration_id, provider=self.provider
                ).first()
                return self._integration
        except Exception as e:
            metrics.incr(
                self._METRIC_CONTROL_PATH_FAILURE_KEY,
                tags={"integration": self.provider, "error": str(e)},
            )
            logger.warning("Failed to get integration from request")

        return None

    def get_response_from_gitea_webhook(self) -> HttpResponseBase:
        cell = self._resolve_cell()
        if cell is None:
            return self.get_response_from_control_silo()

        integration = self.get_integration_from_request()
        if not integration:
            return self.get_default_missing_integration_response()

        try:
            data = orjson.loads(self.request.body)
        except orjson.JSONDecodeError:
            data = {}

        return self.get_response_from_webhookpayload(
            cells=[cell],
            identifier=self.get_mailbox_identifier(integration, data),
            integration_id=integration.id,
        )

    def mailbox_bucket_id(self, data: Mapping[str, Any]) -> int | None:
        """
        The repository a payload is for, so busy instances shard their deliveries
        into per-repository mailboxes that drain in parallel.

        Gitea's hooks are per-repository, so every event body carries one.
        """
        repository = data.get("repository")
        if not isinstance(repository, dict):
            return None
        repo_id = repository.get("id")
        return repo_id if isinstance(repo_id, int) else None

    def get_response(self) -> HttpResponseBase:
        clear_organization_info()
        if self.view_class == GiteaWebhookEndpoint:
            return self.get_response_from_gitea_webhook()
        return self.get_response_from_control_silo()
