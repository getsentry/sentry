import logging
from typing import Any

from botocore.exceptions import ClientError, ParamValidationError
from requests import HTTPError, Timeout
from requests.exceptions import ChunkedEncodingError, ConnectionError, RequestException
from taskbroker_client.retry import Retry

from sentry.shared_integrations.exceptions import ApiHostError, ApiTimeoutError
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import integrations_tasks

logger = logging.getLogger(__name__)


_DATA_FORWARDING_RETRY_ON = (RequestException,)
_DATA_FORWARDING_RETRY_IGNORE = (
    ClientError,
    ParamValidationError,
    ValueError,
)
_DATA_FORWARDING_SILENCED = (
    ChunkedEncodingError,
    Timeout,
    ApiHostError,
    ApiTimeoutError,
    ConnectionError,
    HTTPError,
    *_DATA_FORWARDING_RETRY_IGNORE,
)


@instrumented_task(
    name="sentry.integrations.data_forwarding.tasks.forward_event",
    namespace=integrations_tasks,
    retry=Retry(
        times=3,
        delay=60 * 5,
        on=_DATA_FORWARDING_RETRY_ON,
        ignore=_DATA_FORWARDING_RETRY_IGNORE,
    ),
    processing_deadline_duration=12,
    silo_mode=SiloMode.CELL,
    silenced_exceptions=_DATA_FORWARDING_SILENCED,
)
def forward_event(
    data_forwarder_project_id: int,
    event_payload: dict[str, Any],
    task_payload: dict[str, Any],
) -> None:
    from sentry.integrations.data_forwarding import FORWARDER_REGISTRY
    from sentry.integrations.data_forwarding.base import BaseDataForwarder
    from sentry.integrations.models.data_forwarder_project import DataForwarderProject

    try:
        data_forwarder_project = DataForwarderProject.objects.select_related("data_forwarder").get(
            id=data_forwarder_project_id
        )
    except DataForwarderProject.DoesNotExist:
        return

    provider = data_forwarder_project.data_forwarder.provider
    forwarder: type[BaseDataForwarder] = FORWARDER_REGISTRY[provider]
    forwarder.forward_event_from_task(
        config=data_forwarder_project.get_config(),
        event_payload=event_payload,
        task_payload=task_payload,
    )
    logger.info(
        "data_forwarding.event_forwarded",
        extra={"provider": provider, "project_id": data_forwarder_project.project_id},
    )
