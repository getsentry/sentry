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
from sentry.seer.entrypoints.slack.messaging import send_halt_message
from sentry.silo.base import SiloMode
from sentry.silo.client import CellSiloClient
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import integrations_control_tasks
from sentry.types.cell import Cell, CellResolutionError, get_cell_by_name, get_cell_for_organization

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


class _AsyncSlackSeerDispatcher(_AsyncSlackDispatcher):
    """
    Seer event webhooks carry no ``response_url``; the cell handles the event and
    responds with an empty 200. Suppress response forwarding by always unpacking
    to ``None``.
    """

    def unpack_payload(self, response: Response) -> Any:
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
    channel_id: str,
    thread_ts: str,
    message_ts: str,
    event_type: str,
) -> None:
    """
    Use the algorithm in resolve_seer_organization_for_slack_user to resolve the target organization.
    Since this can route to organizations sharing Slack across cells, we need to run it at the parser.

    We run this as a task because the algorithm will make calls to Slack, increasing the likelihood
    of hitting the 3 second deadline. At that point, Slack may retry the request and we don't
    dedupe these requests, so it'd break the Seer experience.

    Now control will respond immediately, and schedule this task. We can take our time routing,
    and then allow the identified cell to actually handle the event.
    """
    logging_ctx = {
        "integration_id": integration_id,
        "slack_user_id": slack_user_id,
        "channel_id": channel_id,
        "thread_ts": thread_ts,
    }
    integration = integration_service.get_integration(
        integration_id=integration_id, status=ObjectStatus.ACTIVE
    )
    if integration is None:
        logger.warning("route_slack_seer_event.integration_not_found", extra=logging_ctx)
        return

    organization_id, halt_reason = resolve_seer_organization_for_slack_user(
        integration=integration,
        slack_user_id=slack_user_id,
        channel_id=channel_id,
        thread_ts=thread_ts,
        message_ts=message_ts,
        event_type=event_type,
    )
    logging_ctx["organization_id"] = organization_id
    logging_ctx["halt_reason"] = halt_reason

    if halt_reason:
        send_halt_message(
            integration=integration,
            slack_user_id=slack_user_id,
            channel_id=channel_id,
            thread_ts=thread_ts or None,
            halt_reason=halt_reason,
        )
        logger.info("route_slack_seer_event.halt_message_sent", extra=logging_ctx)
        return

    if organization_id is None:
        return

    try:
        cell = get_cell_for_organization(str(organization_id))
    except CellResolutionError:
        logger.exception("route_slack_seer_event.cell_resolution_error", extra=logging_ctx)
        return
    _AsyncSlackSeerDispatcher(payload, response_url="").dispatch([cell.name])
