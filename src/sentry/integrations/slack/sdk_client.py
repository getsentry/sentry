import logging
from functools import wraps
import time
from types import FunctionType

from slack_sdk import WebClient
from slack_sdk.errors import SlackApiError
from slack_sdk.web import SlackResponse

from sentry.constants import ObjectStatus
from sentry.db.postgres.transactions import in_test_hide_transaction_boundary
from sentry.integrations.base import disable_integration, is_response_error, is_response_success
from sentry.integrations.models import Integration
from sentry.integrations.request_buffer import IntegrationRequestBuffer
from sentry.integrations.services.integration import integration_service
from sentry.integrations.services.integration.model import RpcIntegration
from sentry.silo.base import SiloMode
from sentry.integrations.slack.rate_limiter import SlackRateLimiter
from sentry.utils import metrics

SLACK_DATADOG_METRIC = "integrations.slack.http_response"

logger = logging.getLogger(__name__)

SLACK_SDK_WRAP_METHODS = {"api_call"}


def track_response_data(response: SlackResponse, method: str, error: str | None = None) -> None:
    is_ok = response.get("ok", False)
    code = response.status_code

    metrics.incr(
        SLACK_DATADOG_METRIC,
        sample_rate=1.0,
        tags={"ok": is_ok, "status": code},
    )

    # Track rate limit metrics
    if code == 429 and "Retry-After" in response.headers:
        metrics.timing(
            "integration.slack.rate_limit.retry_after",
            int(response.headers.get("Retry-After", 0)),
            tags={"method": method}
        )

    extra = {
        "integration": "slack",
        "status_string": str(code),
        "error": error,
        "method": method,
    }
    logger.info("integration.http_response", extra=extra)



def is_response_fatal(response: SlackResponse) -> bool:
    if not response.get("ok"):
        if "account_inactive" == response.get("error", ""):
            return True
    return False


# TODO: add this to the client somehow
def record_response_for_disabling_integration(response: SlackResponse, integration_id: int) -> None:
    redis_key = f"sentry-integration-error:{integration_id}"

    buffer = IntegrationRequestBuffer(redis_key)
    if is_response_fatal(response):
        buffer.record_fatal()
    else:
        if is_response_success(response):
            buffer.record_success()
            return
        if is_response_error(response):
            buffer.record_error()
    if buffer.is_integration_broken():
        disable_integration(buffer, redis_key, integration_id)


def wrapper(method: FunctionType):
    @wraps(method)
    def wrapped(*args, **kwargs):
        try:
            response = method(*args, **kwargs)
            track_response_data(response=response, method=method.__name__)
        except SlackApiError as e:
            if e.response:
                track_response_data(response=e.response, error=str(e), method=method.__name__)
            else:
                logger.info("slack_sdk.missing_error_response", extra={"error": str(e)})
            raise
        except TimeoutError:
            metrics.incr(
                SLACK_DATADOG_METRIC,
                sample_rate=1.0,
                tags={"status": "timeout"},
            )
            raise

        return response

    return wrapped


def wrap_api_call(cls):
    for name, attribute in vars(cls).items():
        if isinstance(attribute, FunctionType) and attribute.__name__ in SLACK_SDK_WRAP_METHODS:
            setattr(cls, name, wrapper(attribute))


class MetaClass(type):
    def __new__(meta, name, bases, dct):
        cls = super().__new__(meta, name, bases, dct)
        for parent in cls.__bases__:
            for base in parent.__bases__:
                # this wraps the api_call function in the slack_sdk BaseClient class
                wrap_api_call(base)
        return cls


class SlackSdkClient(WebClient, metaclass=MetaClass):
    def __init__(self, integration_id: int):
        self.integration_id = integration_id
        self.rate_limiter = SlackRateLimiter(integration_id)

        integration: Integration | RpcIntegration | None
        if SiloMode.get_current_mode() == SiloMode.REGION:
            """
            # In order to send requests, SlackClient needs to fetch the integration
            # to get access tokens which trips up rpc method/transaction
            # boundary detection. Those boundaries are not relevant because
            # this is a read operation.
            """
            with in_test_hide_transaction_boundary():
                integration = integration_service.get_integration(
                    integration_id=integration_id, status=ObjectStatus.ACTIVE
                )
        else:  # control or monolith (local)
            integration = Integration.objects.filter(
                id=integration_id, status=ObjectStatus.ACTIVE
            ).first()

        if integration is None:
            raise ValueError(f"Integration with id {integration_id} not found")

        access_token = integration.metadata.get("access_token")
        if not access_token:
            raise ValueError(f"Missing token for integration with id {integration_id}")


        # TODO: missing from old SlackClient: verify_ssl, logging_context
        super().__init__(token=access_token)

    def chat_postMessage(self, channel: str, **kwargs):
        """Override to add rate limiting"""
        # Normalize channel format
        if not channel.startswith("#"):
            channel = f"#{channel}"
            
        # Check rate limit
        if wait_time := self.rate_limiter.check_rate_limit(channel):
            # If rate limited, sleep for the required time
            time.sleep(wait_time)
            
        try:
            response = super().chat_postMessage(channel=channel, **kwargs)
            # Update rate limit state for successful requests
            self.rate_limiter.update_rate_limit(channel)
            return response
        except SlackApiError as e:
            if e.response and e.response.status_code == 429:
                # Extract retry_after from headers
                retry_after = None
                if "Retry-After" in e.response.headers:
                    retry_after = int(e.response.headers["Retry-After"])
                # Update rate limit state
                self.rate_limiter.update_rate_limit(channel, retry_after)
            raise
