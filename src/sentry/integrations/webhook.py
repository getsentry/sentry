import logging
from abc import ABC, abstractmethod
from typing import Generic, TypeVar

from django.views.decorators.csrf import csrf_exempt
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint

logger = logging.getLogger(__name__)

T = TypeVar("T")
U = TypeVar("U")


class IntegrationWebhookEndpoint(Endpoint, Generic[T, U], ABC):
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

    @abstractmethod
    def authenticate(self, request: Request, **kwargs) -> T:
        raise NotImplementedError

    @abstractmethod
    def unpack_payload(self, request: Request, **kwargs) -> U:
        raise NotImplementedError

    @csrf_exempt
    def dispatch(self, request, *args, **kwargs):
        response = super().dispatch(request, *args, **kwargs)
        self.log_extra = {"request_method": self.request.method, "request_path": self.request.path}
        return response

    @abstractmethod
    def post(self, request: Request, **kwargs) -> Response:
        raise NotImplementedError
