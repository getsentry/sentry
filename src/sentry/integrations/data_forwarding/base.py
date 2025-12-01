import logging
from abc import ABC, abstractmethod
from typing import Any, ClassVar

from sentry import ratelimits
from sentry.integrations.models.data_forwarder_project import DataForwarderProject
from sentry.integrations.types import DataForwarderProviderSlug
from sentry.services.eventstore.models import Event, GroupEvent

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

    def post_process(
        self, event: Event | GroupEvent, data_forwarder_project: DataForwarderProject
    ) -> None:
        config = data_forwarder_project.get_config()
        self.initialize_variables(event, config)
        if self.is_ratelimited(event):
            return

        payload = self.get_event_payload(event=event, config=config)
        self.forward_event(event=event, payload=payload, config=config)
