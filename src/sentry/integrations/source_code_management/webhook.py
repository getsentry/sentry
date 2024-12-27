import logging
from abc import ABC, abstractmethod
from collections.abc import Mapping
from typing import Any, Generic, TypeVar

from django.http import HttpRequest, HttpResponse
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint
from sentry.api.exceptions import BadRequest
from sentry.integrations.base import IntegrationDomain
from sentry.integrations.utils.metrics import IntegrationWebhookEvent, IntegrationWebhookEventType
from sentry.models.repository import Repository
from sentry.utils import json

logger = logging.getLogger(__name__)

T = TypeVar("T")


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


class SCMWebhookEndpoint(Endpoint, ABC, Generic[T]):
    owner = ApiOwner.ECOSYSTEM
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    authentication_classes = ()
    permission_classes = ()

    def __init__(self, **kwargs):
        super().__init__(**kwargs)

        self.log_extra = {}

    @property
    @abstractmethod
    def provider(self) -> str:
        raise NotImplementedError

    @property
    @abstractmethod
    def _handlers(self) -> dict[str, type[T]]:
        raise NotImplementedError

    @property
    @abstractmethod
    def method_header(self) -> str:
        raise NotImplementedError

    def get_handler(self, request: HttpRequest) -> type[T] | None:
        try:
            event_type = request.headers.get(self.method_header)
            if not event_type:
                raise BadRequest(detail=f"Missing required header {self.method_header}")

            return self._handlers.get(event_type)
        except KeyError:
            log_event = f"{self.provider}.webhook.missing-event"
            logger.exception(log_event, extra=self.log_extra)
            raise BadRequest("Missing handler for event type")

    @abstractmethod
    def check_secret(self, **kwargs) -> str | None:
        pass

    def get_body(self, body: bytes) -> bytes:
        body = bytes(body)
        if not body:
            log_event = f"{self.provider}.webhook.missing-body"
            logger.error(log_event, extra=self.log_extra)
            raise BadRequest("Webhook payload not found")

        return body

    def get_event(self, body: bytes) -> None:
        try:
            event = json.loads(body)
        except json.JSONDecodeError:
            log_event = f"{self.provider}.webhook.invalid-json"
            logger.exception(log_event, extra=self.log_extra)
            raise BadRequest("Invalid JSON payload")

        return event

    def fire_event_handler(
        self, event_handler: SCMWebhook, event: Mapping[str, Any], **kwargs
    ) -> None:
        with IntegrationWebhookEvent(
            interaction_type=event_handler.event_type,
            domain=IntegrationDomain.SOURCE_CODE_MANAGEMENT,
            provider_key=event_handler.provider,
        ).capture():
            event_handler(event, **kwargs)

    @method_decorator(csrf_exempt)
    def dispatch(self, request, *args, **kwargs):
        response = super().dispatch(request, *args, **kwargs)
        self.log_extra.update(
            {"request_method": self.request.method, "request_path": self.request.path}
        )
        return response

    @abstractmethod
    def post(self, request: HttpRequest, **kwargs) -> HttpResponse:
        pass
