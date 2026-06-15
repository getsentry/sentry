import logging
from abc import ABC, abstractmethod
from typing import Any, ClassVar

from sentry import ratelimits
from sentry.integrations.models.data_forwarder_project import DataForwarderProject
from sentry.integrations.types import DataForwarderProviderSlug
from sentry.options.rollout import in_random_rollout
from sentry.services.eventstore.models import Event, GroupEvent
from sentry.utils import metrics

logger = logging.getLogger(__name__)


class BaseDataForwarder(ABC):
    """
    Base class for all data forwarders.
    Copied directly from legacy plugin system, unchanged.
    """

    provider: ClassVar[DataForwarderProviderSlug]
    rate_limit: ClassVar[tuple[int, int]] = (50, 1)
    """
    Tuple of (Number of Requests, Window in Seconds)
    """

    def get_rl_key(self, event: Event | GroupEvent) -> str:
        return f"{self.provider.value}:{event.project.organization_id}"

    def is_ratelimited(self, event: Event | GroupEvent) -> bool:
        rl_key = self.get_rl_key(event)
        limit, window = self.rate_limit
        if limit and window and ratelimits.backend.is_limited(rl_key, limit=limit, window=window):
            logger.info(
                "data_forwarding.skip_rate_limited",
                extra={
                    "event_id": event.event_id,
                    "issue_id": event.group_id,
                    "project_id": event.project_id,
                    "organization_id": event.project.organization_id,
                },
            )
            return True
        return False

    def initialize_variables(self, event: Event | GroupEvent, config: dict[str, Any]) -> None:
        """This is only necessary for migrating Splunk plugin, needed for rate limiting"""
        return

    @abstractmethod
    def forward_event(
        self, event: Event | GroupEvent, payload: dict[str, Any], config: dict[str, Any]
    ) -> bool:
        raise NotImplementedError

    @abstractmethod
    def get_event_payload(
        self, event: Event | GroupEvent, config: dict[str, Any]
    ) -> dict[str, Any]:
        raise NotImplementedError

    @abstractmethod
    def get_task_payload(self, event: Event | GroupEvent, config: dict[str, Any]) -> dict[str, Any]:
        """
        Allows providers to create task-safe payloads from the event to avoid refetching in the task.
        """
        raise NotImplementedError

    @staticmethod
    @abstractmethod
    def forward_event_from_task(
        *,
        config: dict[str, Any],
        event_payload: dict[str, Any],
        task_payload: dict[str, Any],
    ) -> None:
        """
        Similar to forward_event, but raises any exception to allow for retries in a task.
        The task_payload is derived from get_task_payload, to avoid needing to refetch the event.
        """
        raise NotImplementedError

    def post_process(
        self, event: Event | GroupEvent, data_forwarder_project: DataForwarderProject
    ) -> None:
        from sentry.integrations.data_forwarding.tasks import forward_event

        config = data_forwarder_project.get_config()
        self.initialize_variables(event, config)
        if self.is_ratelimited(event):
            return

        event_payload = self.get_event_payload(event=event, config=config)
        if in_random_rollout("data-forwarding.task-rollout-rate"):
            task_payload = self.get_task_payload(event=event, config=config)
            forward_event.delay(
                data_forwarder_project_id=data_forwarder_project.id,
                event_payload=event_payload,
                task_payload=task_payload,
            )
            metrics.incr(
                "data_forwarding.post_process.task_scheduled", tags={"provider": self.provider}
            )
        else:
            self.forward_event(event=event, payload=event_payload, config=config)
            metrics.incr(
                "data_forwarding.post_process.directly_forwarded", tags={"provider": self.provider}
            )
