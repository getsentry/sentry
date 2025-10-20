from __future__ import annotations

from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from sentry.integrations.models.data_forwarder_project import DataForwarderProject
    from sentry.services.eventstore.models import Event


class DataForwardingPlugin:
    provider: str
    name: str
    description: str

    def get_rate_limit(self) -> tuple[int, int]:
        raise NotImplementedError

    def get_event_payload(self, event: Event) -> dict[str, Any]:
        raise NotImplementedError

    def forward_event(self, event: Event, data_forwarder_project: DataForwarderProject) -> bool:
        config = data_forwarder_project.get_config()
        payload = self.get_event_payload(event)
        success = self.send_payload(payload, config, event, data_forwarder_project)

        return success

    def send_payload(
        self,
        payload: dict[str, Any],
        config: dict[str, Any],
        event: Event,
        data_forwarder_project: DataForwarderProject,
    ) -> bool:
        raise NotImplementedError


__all__ = ["DataForwardingPlugin"]
