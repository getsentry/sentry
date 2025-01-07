from abc import ABC, abstractmethod
from collections.abc import Mapping
from typing import Any

from sentry.integrations.utils.metrics import IntegrationWebhookEventType
from sentry.models.repository import Repository


class SCMWebhook(ABC):
    @property
    @abstractmethod
    def provider(self) -> str:
        raise NotImplementedError

    @property
    @abstractmethod
    def event_type(self) -> IntegrationWebhookEventType:
        raise NotImplementedError

    @abstractmethod
    def __call__(self, event: Mapping[str, Any], **kwargs) -> None:
        raise NotImplementedError

    @abstractmethod
    def update_repo_data(self, repo: Repository, event: Mapping[str, Any]) -> None:
        raise NotImplementedError
