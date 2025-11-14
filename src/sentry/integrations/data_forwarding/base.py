from __future__ import annotations

from abc import ABC, abstractmethod
from typing import int, ClassVar

from sentry.integrations.models.data_forwarder_project import DataForwarderProject
from sentry.integrations.types import DataForwarderProviderSlug
from sentry.services.eventstore.models import Event


class BaseDataForwarder(ABC):
    """Base class for all data forwarders."""

    provider: ClassVar[DataForwarderProviderSlug]
    rate_limit: ClassVar[tuple[int, int] | None] = None
    description: ClassVar[str] = ""

    @classmethod
    @abstractmethod
    def forward_event(cls, event: Event, data_forwarder_project: DataForwarderProject) -> bool:
        pass
