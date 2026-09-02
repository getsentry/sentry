from __future__ import annotations

import logging
from abc import ABC
from concurrent.futures import as_completed
from typing import TYPE_CHECKING, Any, ClassVar

import orjson
from django.core.cache import cache
from django.http import HttpRequest, HttpResponse
from django.http.response import HttpResponseBase
from django.urls import ResolverMatch, resolve
from rest_framework import status

from sentry.api.base import ONE_DAY
from sentry.constants import ObjectStatus
from sentry.hybridcloud.models.webhookpayload import DestinationType, WebhookPayload
from sentry.hybridcloud.outbox.category import WebhookProviderIdentifier
from sentry.hybridcloud.services.organization_mapping import organization_mapping_service
from sentry.hybridcloud.services.organization_mapping.model import RpcOrganizationMapping
from sentry.hybridcloud.tasks.deliver_webhooks import maybe_trigger_drain
from sentry.hybridcloud.webhook_event_types import MAILBOX_EVENT_TYPES
from sentry.integrations.middleware.metrics import (
    MiddlewareHaltReason,
    MiddlewareOperationEvent,
    MiddlewareOperationType,
)
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.services.integration.model import RpcIntegration
from sentry.killswitches import get_killswitch_value, value_matches
from sentry.logging.handlers import SamplingFilter
from sentry.ratelimits import backend as ratelimiter
from sentry.silo.base import SiloLimit, SiloMode
from sentry.silo.client import CellSiloClient, SiloClientError
from sentry.types.cell import Cell, find_cells_for_orgs, get_cell_by_name
from sentry.utils import metrics
from sentry.utils.concurrent import ContextPropagatingThreadPoolExecutor

logger = logging.getLogger(__name__)
if TYPE_CHECKING:
    from sentry.middleware.integrations.integration_control import ResponseHandler

SHED_INBOUND_KILLSWITCH = "hybridcloud.webhookpayload.shed-inbound"
SHED_RETRY_AFTER_SECONDS = 60
# Its own logger so the sampling stays on the shed line, rather than quietly
# applying to every info log a future caller adds to this module.
shed_logger = logging.getLogger("sentry.integrations.webhooks.shed")
shed_logger.addFilter(SamplingFilter(0.1))


def create_async_request_payload(request: HttpRequest) -> dict[str, Any]:
    return {
        "method": request.method,
        "path": request.get_full_path(),
        "uri": request.build_absolute_uri(),
        "headers": {k: v for k, v in request.headers.items()},
        "body": request.body.decode(encoding="utf-8"),
    }


class CellResult:
    def __init__(
        self,
        response: HttpResponseBase | None = None,
        error: Exception | None = None,
    ):
        self.response = response
        self.error = error


class BaseRequestParser(ABC):
    """Base Class for Integration Request Parsers"""

    provider: ClassVar[str]
    """The integration provider identifier"""

    webhook_identifier: ClassVar[WebhookProviderIdentifier]
    """The webhook provider identifier"""

    mailbox_bucket_count: ClassVar[int] = 100
    """How many sub-mailboxes `mailbox_bucket_id` is spread over.

    Every mailbox costs a scheduler row and a dispatch slot, so splitting past what
    the volume needs buys queue rows rather than parallelism.
    """

    always_bucket: ClassVar[bool] = False
    """Split every integration's mailbox by `mailbox_bucket_id` instead of waiting
    for it to exceed the hourly rate limit first."""

    def __init__(self, request: HttpRequest, response_handler: ResponseHandler):
        self.request = request
        self.match: ResolverMatch = resolve(self.request.path)
        self.view_class = None
        if hasattr(self.match.func, "view_class"):
            self.view_class = self.match.func.view_class
        self.response_handler = response_handler
        self._shed_decisions: dict[int | None, bool] = {}

    # Common Helpers

    def ensure_control_silo(self):
        with MiddlewareOperationEvent(
            operation_type=MiddlewareOperationType.ENSURE_CONTROL_SILO,
            integration_name=self.provider,
        ).capture() as lifecycle:
            lifecycle.add_extras(
                {
                    "path": self.request.path,
                    "silo": SiloMode.get_current_mode().value,
                }
            )
            if SiloMode.get_current_mode() != SiloMode.CONTROL:
                raise SiloLimit.AvailabilityError(
                    "Integration Request Parsers should only be run on the control silo."
                )

    def is_json_request(self) -> bool:
        if not self.request.headers:
            return False
        return "application/json" in self.request.headers.get("Content-Type", "")

    #  Silo Response Helpers

    def get_response_from_control_silo(self) -> HttpResponseBase:
        """
        Used to handle the request directly on the control silo.
        """
        self.ensure_control_silo()

        with MiddlewareOperationEvent(
            operation_type=MiddlewareOperationType.GET_CONTROL_RESPONSE,
            integration_name=self.provider,
        ).capture() as lifecycle:
            lifecycle.add_extra("path", self.request.path)
            response = self.response_handler(self.request)
            return response

    def get_response_from_cell_silo(self, cell: Cell) -> HttpResponseBase:
        with metrics.timer(
            "integration_proxy.control.get_response_from_cell_silo",
            tags={"destination_cell": cell.name},
            sample_rate=1.0,
        ):
            cell_client = CellSiloClient(cell, retry=True)
            with MiddlewareOperationEvent(
                operation_type=MiddlewareOperationType.GET_CELL_RESPONSE,
                integration_name=self.provider,
                cell=cell.name,
            ).capture() as lifecycle:
                lifecycle.add_extras(
                    {
                        "path": self.request.path,
                        "region": cell.name,
                    }
                )

                http_response = cell_client.proxy_request(incoming_request=self.request)
                return http_response

    def get_responses_from_cell_silos(self, cells: list[Cell]) -> dict[str, CellResult]:
        """
        Used to handle the requests on a given list of cells (synchronously).
        Returns a dict of cell name to response/exception.
        """
        self.ensure_control_silo()

        cell_to_response_map = {}

        with ContextPropagatingThreadPoolExecutor(max_workers=len(cells)) as executor:
            future_to_cell = {
                executor.submit(self.get_response_from_cell_silo, cell): cell for cell in cells
            }
            for future in as_completed(future_to_cell):
                cell = future_to_cell[future]
                try:
                    cell_response = future.result()
                except Exception as e:
                    cell_to_response_map[cell.name] = CellResult(error=e)
                else:
                    cell_to_response_map[cell.name] = CellResult(response=cell_response)

        return cell_to_response_map

    def get_response_from_webhookpayload(
        self,
        cells: list[Cell],
        identifier: int | str | None = None,
        integration_id: int | None = None,
    ) -> HttpResponseBase:
        """
        Used to create webhookpayloads for provided cells to handle the webhooks asynchronously.
        Responds to the webhook provider with a 202 Accepted status.
        """
        shed_response = self.get_shed_response(integration_id=integration_id)
        if shed_response is not None:
            return shed_response

        if len(cells) < 1:
            return HttpResponse(status=status.HTTP_202_ACCEPTED)

        shard_identifier = identifier or self.webhook_identifier.value
        # Create all payloads first, then trigger one drain per (cell-scoped) mailbox.
        payloads = [
            WebhookPayload.create_from_request(
                destination_type=DestinationType.SENTRY_CELL,
                cell=cell.name,
                provider=self.provider,
                identifier=shard_identifier,
                integration_id=integration_id,
                request=self.request,
            )
            for cell in cells
        ]
        for mailbox_name in {payload.mailbox_name for payload in payloads}:
            maybe_trigger_drain(mailbox_name)

        return HttpResponse(status=status.HTTP_202_ACCEPTED)

    def get_shed_response(self, integration_id: int | None = None) -> HttpResponse | None:
        """
        Get an optional response when inbound webhooks have been shed with a killswitch.
        Drops the webhook with a 429 before the WebhookPayload INSERT and the push
        trigger, the writes that make a flood expensive. Use the
        `hybridcloud.webhookpayload.shed-inbound` killswitch to control which providers
        and integrations are dropped. Returns None to handle the request normally.
        """
        if not self._should_shed(integration_id):
            return None

        response = HttpResponse(status=status.HTTP_429_TOO_MANY_REQUESTS)
        response["Retry-After"] = str(SHED_RETRY_AFTER_SECONDS)
        return response

    def _should_shed(self, integration_id: int | None) -> bool:
        """
        Decide once per parser, which is once per request. A parser that checks the shed
        early still reaches the base class check in get_response_from_webhookpayload, and
        the config read and the counters below are not free to repeat.
        """
        if integration_id not in self._shed_decisions:
            self._shed_decisions[integration_id] = self._evaluate_shed(integration_id)
        return self._shed_decisions[integration_id]

    def _evaluate_shed(self, integration_id: int | None) -> bool:
        conditions = get_killswitch_value(SHED_INBOUND_KILLSWITCH)
        # A condition with no provider matches every provider. There are few enough
        # providers to name them, so drop those rather than let one option typo shed
        # all inbound traffic. Counted so an ignored condition is not a silent no-op.
        targeted = [condition for condition in conditions if condition.get("provider") is not None]
        if len(targeted) != len(conditions):
            metrics.incr("hybridcloud.webhookpayload.shed_condition_ignored")

        if not value_matches(
            SHED_INBOUND_KILLSWITCH,
            targeted,
            {"provider": self.provider, "integration_id": integration_id},
            emit_metrics=False,
        ):
            return False

        metrics.incr(
            "hybridcloud.webhookpayload.shed",
            tags={"provider": self.provider},
            sample_rate=1.0,
        )
        shed_logger.info(
            "hybridcloud.webhookpayload.shed",
            extra={"provider": self.provider, "integration_id": integration_id},
        )
        return True

    def get_request_body(self) -> dict[str, Any]:
        """Empty when the body is not a JSON object. A payload that does not parse
        still has to be queued, so callers fall back to the integration-level mailbox.
        """
        try:
            body = orjson.loads(self.request.body)
        except orjson.JSONDecodeError:
            return {}
        return body if isinstance(body, dict) else {}

    def get_mailbox_identifier(
        self, integration: RpcIntegration | Integration, data: dict[str, Any]
    ) -> str:
        """
        Used by integrations with higher hook volumes to create smaller mailboxes
        that can be delivered in parallel. Requires the integration to implement
        `mailbox_bucket_id`
        """
        identifier = self._bucketed_mailbox_identifier(integration, data)
        event_type = self._mailbox_event_type(data)
        return f"{identifier}:{event_type}" if event_type else identifier

    def _bucketed_mailbox_identifier(
        self, integration: RpcIntegration | Integration, data: dict[str, Any]
    ) -> str:
        """The mailbox identifier up to the bucket, before any event-type suffix.

        Falls back to the integration-level mailbox when the integration is below
        the volume that warrants buckets, or when no bucket ID is available."""
        if not self.always_bucket and not self._exceeds_bucketing_volume(integration):
            self._record_mailbox_routing(bucketed=False, reason="under_volume_gate")
            return str(integration.id)

        mailbox_bucket_id = self.mailbox_bucket_id(data)
        if mailbox_bucket_id is None:
            self._record_mailbox_routing(bucketed=False, reason="no_bucket_key")
            return str(integration.id)

        bucket_number = mailbox_bucket_id % self.mailbox_bucket_count
        self._record_mailbox_routing(bucketed=True, reason="bucketed")

        return f"{integration.id}:{bucket_number}"

    def _exceeds_bucketing_volume(self, integration: RpcIntegration | Integration) -> bool:
        # If we get fewer than 3000 in 1 hour we don't need to split into buckets
        ratelimit_key = f"webhookpayload:{self.provider}:{integration.id}"
        use_buckets_key = f"{ratelimit_key}:use_buckets"

        if cache.get(use_buckets_key):
            return True
        if ratelimiter.is_limited(key=ratelimit_key, window=60 * 60, limit=3000):
            # Once we have gone over the rate limit in a day, we use smaller
            # buckets for the next day.
            cache.set(use_buckets_key, 1, timeout=ONE_DAY)
            return True
        return False

    def _record_mailbox_routing(self, bucketed: bool, reason: str) -> None:
        """`reason` is the full breakdown; `bucketed` stays for the dashboards on it."""
        metrics.incr(
            "hybridcloud.webhookpayload.mailbox_routing",
            tags={
                "provider": self.provider,
                "bucketed": "true" if bucketed else "false",
                "reason": reason,
            },
        )

    def mailbox_bucket_id(self, data: dict[str, Any]) -> int | None:
        raise NotImplementedError(
            "You must implement mailbox_bucket_id to use bucketed identifiers"
        )

    def _mailbox_event_type(self, data: dict[str, Any]) -> str | None:
        """Validation lives here, not in the subclass: the discriminator comes out of
        a body control has not verified — gitlab and bitbucket resolve their handlers
        on the cell — so an unvalidated one would put an attacker-chosen string into
        `mailbox_name`, and with it unbounded mailboxes and scheduler entries.
        """
        known_event_types = MAILBOX_EVENT_TYPES.get(self.provider)
        if not known_event_types:
            return None
        event_type = self.mailbox_event_type(data)
        return event_type if event_type in known_event_types else None

    def mailbox_event_type(self, data: dict[str, Any]) -> str | None:
        """Returned unvalidated; `_mailbox_event_type` checks it against the
        registry.
        """
        return None

    def get_response_from_first_cell(self):
        cells = self.get_cells_from_organizations()
        first_cell = cells[0]
        response_map = self.get_responses_from_cell_silos(cells=[first_cell])
        cell_result = response_map[first_cell.name]
        with MiddlewareOperationEvent(
            operation_type=MiddlewareOperationType.GET_RESPONSE_FROM_FIRST_CELL,
            integration_name=self.provider,
            cell=first_cell.name,
        ).capture() as lifecycle:
            lifecycle.add_extras(
                {
                    "path": self.request.path,
                    "region": first_cell.name,
                }
            )
            if cell_result.error is not None:
                # We want to fail loudly so that devs know this error happened on the cell silo (for now)
                raise SiloClientError(cell_result.error)
            return cell_result.response

    def get_response_from_all_cells(self):
        cells = self.get_cells_from_organizations()
        response_map = self.get_responses_from_cell_silos(cells=cells)
        successful_responses = [
            result for result in response_map.values() if result.response is not None
        ]
        with MiddlewareOperationEvent(
            operation_type=MiddlewareOperationType.GET_RESPONSE_FROM_ALL_CELLS,
            integration_name=self.provider,
        ).capture() as lifecycle:
            lifecycle.add_extra("path", self.request.path)
            if len(successful_responses) == 0:
                error_map_str = ", ".join(
                    f"{cell}: {result.error}" for cell, result in response_map.items()
                )
                raise SiloClientError("No successful cell responses", error_map_str)
            return successful_responses[0].response

    # Required Overrides

    def get_response(self) -> HttpResponseBase:
        """
        Used to surface a response as part of the middleware.
        Should be overwritten by implementation.
        Default behaviour is handle the response ignoring SiloMode.
        """
        return self.response_handler(self.request)

    def get_integration_from_request(self) -> Integration | None:
        """
        Parse the request to retrieve integration the request pertains to.
        Should be overwritten by implementation.
        """
        return None

    # Optional Overrides

    def get_organizations_from_integration(
        self, integration: Integration | RpcIntegration | None = None
    ) -> list[RpcOrganizationMapping]:
        """
        Use the get_integration_from_request() method to identify organizations associated with
        the integration request.
        """
        with MiddlewareOperationEvent(
            operation_type=MiddlewareOperationType.GET_ORGS_FROM_INTEGRATION,
            integration_name=self.provider,
        ).capture() as lifecycle:
            lifecycle.add_extras(
                {
                    "path": self.request.path,
                }
            )
            if not integration:
                integration = self.get_integration_from_request()
            if not integration:
                raise Integration.DoesNotExist()

            lifecycle.add_extra("integration_id", integration.id)

            organization_integrations = OrganizationIntegration.objects.filter(
                integration_id=integration.id,
                status=ObjectStatus.ACTIVE,
            )

            if organization_integrations.count() == 0:
                lifecycle.record_halt(
                    halt_reason=MiddlewareHaltReason.ORG_INTEGRATION_DOES_NOT_EXIST
                )
                return []

            organization_ids = [oi.organization_id for oi in organization_integrations]
            all_organizations = organization_mapping_service.get_many(
                organization_ids=organization_ids
            )

            # Integrations will attempt to target a specific organization
            return self.filter_organizations_from_request(organizations=all_organizations)

    def filter_organizations_from_request(
        self,
        organizations: list[RpcOrganizationMapping],
    ) -> list[RpcOrganizationMapping]:
        """
        Parse the request to retrieve the organization to forward the request to.
        Should be overwritten by implementation.
        """
        return organizations

    def get_cells_from_organizations(
        self, organizations: list[RpcOrganizationMapping] | None = None
    ) -> list[Cell]:
        """
        Use the get_organizations_from_integration() method to identify forwarding cells.
        """
        if not organizations:
            organizations = self.get_organizations_from_integration()

        if len(organizations) == 0:
            return []

        cell_names = find_cells_for_orgs([org.id for org in organizations])
        return sorted([get_cell_by_name(name) for name in cell_names], key=lambda r: r.name)

    def get_default_missing_integration_response(self) -> HttpResponse:
        return HttpResponse(status=status.HTTP_400_BAD_REQUEST)
