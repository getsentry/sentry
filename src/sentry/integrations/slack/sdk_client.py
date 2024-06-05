import logging
from functools import wraps
from types import FunctionType

from slack_sdk import WebClient
from slack_sdk.errors import SlackApiError
from slack_sdk.web import SlackResponse

from sentry.models.integrations import Integration
from sentry.services.hybrid_cloud.integration import integration_service
from sentry.silo.base import SiloMode
from sentry.utils import metrics

SLACK_DATADOG_METRIC = "integrations.slack.http_response"

logger = logging.getLogger(__name__)


def track_response_data(response: SlackResponse, error: str | None = None) -> None:
    is_ok = response.get("ok", False)
    code = response.status_code

    metrics.incr(
        SLACK_DATADOG_METRIC,
        sample_rate=1.0,
        tags={"ok": is_ok, "status": code},
    )

    extra = {
        "integration": "slack",
        "status_string": str(code),
        "error": error,
    }
    logger.info("integration.http_response", extra=extra)


def wrapper(method):
    @wraps(method)
    def wrapped(*args, **kwargs):
        try:
            response = method(*args, **kwargs)
            if isinstance(response, SlackResponse):
                track_response_data(response=response)
        except SlackApiError as e:
            if e.response:
                track_response_data(response=e.response, error=str(e))
            else:
                logger.info("slack_sdk.missing_error_response", extra={"error": str(e)})
            raise

        return response

    return wrapped


def wrap_methods_in_class(cls):
    for name, attribute in vars(cls).items():
        if isinstance(attribute, FunctionType):
            setattr(cls, name, wrapper(attribute))

    for base in cls.__bases__:
        wrap_methods_in_class(base)


class MetaClass(type):
    def __new__(meta, name, bases, dct):
        cls = super().__new__(meta, name, bases, dct)
        wrap_methods_in_class(cls)
        return cls

    def __init__(cls, name, bases, dct):
        super().__init__(name, bases, dct)


class SlackSdkClient(WebClient, metaclass=MetaClass):
    def __init__(self, integration_id: int):
        integration = None
        if SiloMode.get_current_mode() == SiloMode.REGION:
            integration = integration_service.get_integration(integration_id=integration_id)
        else:  # control or monolith (local)
            integration = Integration.objects.filter(id=integration_id).first()

        if integration is None:
            raise ValueError(f"Integration with id {integration_id} not found")

        access_token = integration.metadata.get("access_token")
        if not access_token:
            raise ValueError(f"Missing token for integration with id {integration_id}")

        # TODO: missing from old SlackClient: verify_ssl, logging_context
        super().__init__(token=access_token)
