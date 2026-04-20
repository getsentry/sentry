import logging
from abc import ABC, abstractmethod
from collections.abc import Iterable
from dataclasses import dataclass
from typing import Any, cast

import orjson
import requests
import sentry_sdk
from requests import Response
from rest_framework import status
from taskbroker_client.retry import Retry

from sentry.constants import ObjectStatus
from sentry.integrations.services.integration import integration_service
from sentry.integrations.slack.requests.event import resolve_seer_organization_for_slack_user
from sentry.integrations.types import IntegrationProviderSlug
from sentry.silo.base import SiloMode
from sentry.silo.client import CellSiloClient
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import integrations_control_tasks
from sentry.types.cell import Cell, get_cell_by_name, get_cell_for_organization

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class _AsyncResult:
    cell: Cell
    response: Response

    def was_successful(self) -> bool:
        return 200 <= self.response.status_code < 300


@dataclass(frozen=True)
class _AsyncCellDispatcher(ABC):
    request_payload: dict[str, Any]
    response_url: str

    @property
    @abstractmethod
    def log_code(self) -> str:
        raise NotImplementedError

    def log_message(self, tag: str) -> str:
        return f"{self.log_code}.{tag}"

    def dispatch(self, cell_names: Iterable[str]) -> Response | None:
        results = [self._dispatch_to_cell(name) for name in cell_names]
        successes = [r for r in results if r.was_successful()]

        logger.info(
            self.log_message("async_cell_response"),
            extra={
                "regions": [r.cell.name for r in successes],
                "response_map": {r.cell.name: r.response.status_code for r in results},
            },
        )

        if successes:
            # Typically we expect only one request to be made or only one successful
            # response. If there are multiple, forward one arbitrarily.
            return self._forward_response(successes[-1])
        else:
            return None

    @abstractmethod
    def unpack_payload(self, response: Response) -> Any:
        raise NotImplementedError

    def _dispatch_to_cell(self, cell_name: str) -> _AsyncResult:
        cell = get_cell_by_name(cell_name)
        client = CellSiloClient(cell=cell)
        response = client.request(
            method=self.request_payload["method"],
            path=self.request_payload["path"],
            headers=self.request_payload["headers"],
            data=self.request_payload["body"].encode("utf-8"),
            json=False,
            raw_response=True,
        )
        return _AsyncResult(cell, cast(Response, response))

    def _forward_response(self, result: _AsyncResult) -> Response | None:
        if not result.was_successful():
            raise ValueError("Cannot forward a failed result")
        try:
            response_payload = self.unpack_payload(result.response)
            if response_payload is None:
                return None
            integration_response = requests.post(self.response_url, json=response_payload)
        except Exception as exc:
            sentry_sdk.capture_exception(exc)
            return None
        else:
            logger.info(
                "integration.async_integration_response",
                extra={
                    "path": self.request_payload["path"],
                    "cell": result.cell.name,
                    "cell_status_code": result.response.status_code,
                    "integration_status_code": integration_response.status_code,
                },
            )
            return integration_response


class _AsyncSlackDispatcher(_AsyncCellDispatcher):
    @property
    def log_code(self) -> str:
        return IntegrationProviderSlug.SLACK.value

    def unpack_payload(self, response: Response) -> Any:
        if response.content:
            return orjson.loads(response.content)
        return None


@instrumented_task(
    name="sentry.middleware.integrations.tasks.convert_to_async_slack_response",
    namespace=integrations_control_tasks,
    retry=Retry(times=2, delay=5),
    silo_mode=SiloMode.CONTROL,
)
def convert_to_async_slack_response(
    payload: dict[str, Any],
    response_url: str,
    cell_names: list[str],
) -> None:
    _AsyncSlackDispatcher(payload, response_url).dispatch(cell_names)


class _AsyncDiscordDispatcher(_AsyncCellDispatcher):
    @property
    def log_code(self) -> str:
        return IntegrationProviderSlug.DISCORD.value

    def unpack_payload(self, response: Response) -> Any:
        # Cell will return a response assuming it's meant to go directly to Discord. Since we're
        # handling the request asynchronously, we extract only the data, and post it to the webhook
        # that discord provides.
        # https://discord.com/developers/docs/interactions/receiving-and-responding#followup-messages
        return orjson.loads(response.content).get("data")


@instrumented_task(
    name="sentry.middleware.integrations.tasks.convert_to_async_discord_response",
    namespace=integrations_control_tasks,
    retry=Retry(times=2, delay=5),
    silo_mode=SiloMode.CONTROL,
)
def convert_to_async_discord_response(
    payload: dict[str, Any],
    response_url: str,
    cell_names: list[str],
) -> None:
    """
    This task asks relevant cell silos for response data to send asynchronously to Discord. It
    assumes Discord has received a callback of type:5 (DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE).
    (See https://discord.com/developers/docs/interactions/receiving-and-responding#interaction-response-object-interaction-callback-type)

    In the event this task finishes prior to returning the above type, the outbound post will fail.
    """
    response = _AsyncDiscordDispatcher(payload, response_url).dispatch(cell_names)

    if response is not None and response.status_code == status.HTTP_404_NOT_FOUND:
        raise Exception("Discord hook is not ready.")


@instrumented_task(
    name="sentry.middleware.integrations.tasks.route_slack_seer_event",
    namespace=integrations_control_tasks,
    retry=Retry(times=2, delay=5),
    silo_mode=SiloMode.CONTROL,
)
def route_slack_seer_event(
    *,
    payload: dict[str, Any],
    integration_id: int,
    slack_user_id: str,
) -> None:
    """
    Resolve the target org for a Seer Slack event and forward the original webhook
    payload to that org's cell. The parser already 200'd Slack, so this runs with no
    deadline pressure and the cell handles all business logic as usual.

    When resolution fails (no linked identity, no eligible org), forward to the first
    cell among attached orgs so the webhook can still render the identity-link prompt
    or no-op — matching pre-ack behavior.
    """
    integration = integration_service.get_integration(
        integration_id=integration_id, status=ObjectStatus.ACTIVE
    )
    if integration is None:
        return

    result = resolve_seer_organization_for_slack_user(
        integration=integration, slack_user_id=slack_user_id
    )
    if result.organization_id is not None:
        target_cell: Cell = get_cell_for_organization(str(result.organization_id))
    else:
        ois = integration_service.get_organization_integrations(
            integration_id=integration_id, status=ObjectStatus.ACTIVE
        )
        cell_names = sorted({get_cell_for_organization(str(oi.organization_id)).name for oi in ois})
        if not cell_names:
            return
        target_cell = get_cell_by_name(cell_names[0])

    client = CellSiloClient(cell=target_cell)
    try:
        client.request(
            method=payload["method"],
            path=payload["path"],
            headers=payload["headers"],
            data=payload["body"].encode("utf-8"),
            json=False,
            raw_response=True,
        )
    except Exception:
        logger.exception(
            "slack.route_seer_event.forward_failed",
            extra={
                "integration_id": integration_id,
                "cell": target_cell.name,
                "organization_id": result.organization_id,
            },
        )
