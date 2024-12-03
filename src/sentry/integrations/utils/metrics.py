import logging
from abc import ABC, abstractmethod
from collections.abc import Mapping
from dataclasses import dataclass
from enum import StrEnum
from types import TracebackType
from typing import Any, Self

from sentry.integrations.base import IntegrationDomain
from sentry.integrations.types import EventLifecycleOutcome
from sentry.utils import metrics

logger = logging.getLogger(__name__)


class EventLifecycleMetric(ABC):
    """Information about an event to be measured.

    This is a generic base class not tied specifically to integrations. See
    IntegrationEventLifecycleMetric for integration-specific key structure. (This
    class could be moved from this module to a more generic package if we ever want
    to use it outside of integrations.)
    """

    @abstractmethod
    def get_metric_key(self, outcome: EventLifecycleOutcome) -> str:
        """Get the metrics key that will identify this event."""
        raise NotImplementedError

    @abstractmethod
    def get_metric_tags(self) -> Mapping[str, str]:
        """Get the metrics tags that will identify this event along with the key."""
        raise NotImplementedError

    def get_extras(self) -> Mapping[str, Any]:
        """Get extra data to log."""
        return {}

    def capture(self, assume_success: bool = True) -> "EventLifecycle":
        """Open a context to measure the event."""
        return EventLifecycle(self, assume_success)


class IntegrationEventLifecycleMetric(EventLifecycleMetric, ABC):
    """A metric relating to integrations that uses a standard naming structure."""

    def get_metrics_domain(self) -> str:
        """Return a constant describing the top-level metrics category.

        This defaults to a catch-all value but can optionally be overridden.
        """

        return "slo"

    @abstractmethod
    def get_integration_domain(self) -> IntegrationDomain:
        """Return the domain that the integration belongs to."""
        raise NotImplementedError

    @abstractmethod
    def get_integration_name(self) -> str:
        """Return the name of the integration.

        This value generally should match a package name from `sentry.integrations`.
        """
        raise NotImplementedError

    @abstractmethod
    def get_interaction_type(self) -> str:
        """Return a key representing the category of interaction being captured.

        Generally, this string value should always come from an instance of an Enum
        class. But each subclass can define its own Enum of interaction types and
        there is no strict contract that relies on the Enum class.
        """

        raise NotImplementedError

    def get_metric_key(self, outcome: EventLifecycleOutcome) -> str:
        tokens = ("integrations", self.get_metrics_domain(), str(outcome))
        return ".".join(tokens)

    def get_metric_tags(self) -> Mapping[str, str]:
        return {
            "integration_domain": str(self.get_integration_domain()),
            "integration_name": self.get_integration_name(),
            "interaction_type": self.get_interaction_type(),
        }


class EventLifecycle:
    """Context object that measures an event that may succeed or fail.

    The `assume_success` attribute can be set to False for events where exiting the
    context may or may not represent a failure condition. In this state,
    if the program exits the context without `record_success` or `record_failure`
    being called first, it will log the outcome "halted" in place of "success" or
    "failure". "Halted" could mean that we received an ambiguous exception from a
    remote service that may have been caused either by a bug or user error, or merely
    that inserting `record_failure` calls is still a dev to-do item.
    """

    def __init__(self, payload: EventLifecycleMetric, assume_success: bool = True) -> None:
        self.payload = payload
        self.assume_success = assume_success
        self._state: EventLifecycleOutcome | None = None
        self._extra = dict(self.payload.get_extras())

    def add_extra(self, name: str, value: Any) -> None:
        """Add a value to logged "extra" data.

        Overwrites the name with a new value if it was previously used.
        """
        self._extra[name] = value

    def add_extras(self, extras: Mapping[str, int | str]) -> None:
        """Add multiple values to logged "extra" data."""
        self._extra.update(extras)

    def record_event(
        self, outcome: EventLifecycleOutcome, outcome_reason: BaseException | str | None = None
    ) -> None:
        """Record a starting or halting event.

        This method is public so that unit tests may mock it, but it should be called
        only by the other "record" methods.
        """

        key = self.payload.get_metric_key(outcome)
        tags = self.payload.get_metric_tags()

        sample_rate = 1.0
        metrics.incr(key, tags=tags, sample_rate=sample_rate)

        extra = dict(self._extra)
        extra.update(tags)
        log_params: dict[str, Any] = {
            "extra": extra,
        }

        if isinstance(outcome_reason, BaseException):
            log_params["exc_info"] = outcome_reason
        elif isinstance(outcome_reason, str):
            extra["outcome_reason"] = outcome_reason

        if outcome == EventLifecycleOutcome.FAILURE:
            logger.error(key, **log_params)
        elif outcome == EventLifecycleOutcome.HALTED:
            logger.warning(key, **log_params)

    @staticmethod
    def _report_flow_error(message) -> None:
        logger.error("EventLifecycle flow error: %s", message)

    def _terminate(
        self, new_state: EventLifecycleOutcome, outcome_reason: BaseException | str | None = None
    ) -> None:
        if self._state is None:
            self._report_flow_error("The lifecycle has not yet been entered")
        if self._state != EventLifecycleOutcome.STARTED:
            self._report_flow_error("The lifecycle has already been exited")
        self._state = new_state
        self.record_event(new_state, outcome_reason)

    def record_success(self) -> None:
        """Record that the event halted successfully.

        Exiting the context without raising an exception will call this method
        automatically, unless the context was initialized with `assume_success` set
        to False.
        """

        self._terminate(EventLifecycleOutcome.SUCCESS)

    def record_failure(
        self, failure_reason: BaseException | str | None = None, extra: dict[str, Any] | None = None
    ) -> None:
        """Record that the event halted in failure. Additional data may be passed
        to be logged.

        There is no need to call this method directly if an exception is raised from
        inside the context. It will be called automatically when exiting the context
        on an exception.

        This method should be called if we return a soft failure from the event. For
        example, if we receive an error status from a remote service and gracefully
        display an error response to the user, it would be necessary to manually call
        `record_failure` on the context object.
        """

        if extra:
            self._extra.update(extra)
        self._terminate(EventLifecycleOutcome.FAILURE, failure_reason)

    def record_halt(
        self, halt_reason: BaseException | str | None = None, extra: dict[str, Any] | None = None
    ) -> None:
        """Record that the event halted in an ambiguous state.

        This method can be called in response to a sufficiently ambiguous exception
        or other error condition, where it may have been caused by a user error or
        other expected condition, but there is some substantial chance that it
        represents a bug.

        Such cases usually mean that we want to:
          (1) document the ambiguity;
          (2) monitor it for sudden spikes in frequency; and
          (3) investigate whether more detailed error information is available
              (but probably later, as a backlog item).
        """

        if extra:
            self._extra.update(extra)
        self._terminate(EventLifecycleOutcome.HALTED, halt_reason)

    def __enter__(self) -> Self:
        if self._state is not None:
            self._report_flow_error("The lifecycle has already been entered")
        self._state = EventLifecycleOutcome.STARTED
        self.record_event(EventLifecycleOutcome.STARTED)
        return self

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc_value: BaseException | None,
        traceback: TracebackType,
    ) -> None:
        if self._state != EventLifecycleOutcome.STARTED:
            # The context called record_success or record_failure being closing,
            # so we can just exit quietly.
            return

        if exc_value is not None:
            # We were forced to exit the context by a raised exception.
            self.record_failure(exc_value)
        else:
            # We exited the context without record_success or record_failure being
            # called. Assume success if we were told to do so. Else, log a halt
            # indicating that there is no clear success or failure signal.
            self._terminate(
                EventLifecycleOutcome.SUCCESS
                if self.assume_success
                else EventLifecycleOutcome.HALTED
            )


class IntegrationPipelineViewType(StrEnum):
    """A specific step in an integration's pipeline that is not a static page."""

    # IdentityProviderPipeline
    IDENTITY_LOGIN = "identity_login"
    IDENTITY_LINK = "identity_link"
    TOKEN_EXCHANGE = "token_exchange"

    # GitHub
    OAUTH_LOGIN = "oauth_loging"
    GITHUB_INSTALLATION = "github_installation"

    # Bitbucket
    VERIFY_INSTALLATION = "verify_installation"

    # Bitbucket Server
    # OAUTH_LOGIN = "OAUTH_LOGIN"
    OAUTH_CALLBACK = "oauth_callback"

    # Azure DevOps
    ACCOUNT_CONFIG = "account_config"


@dataclass
class IntegrationPipelineViewEvent(IntegrationEventLifecycleMetric):
    """An instance to be recorded of a user going through an integration pipeline view (step)."""

    interaction_type: IntegrationPipelineViewType
    domain: IntegrationDomain
    provider_key: str

    def get_metrics_domain(self) -> str:
        return "installation"

    def get_integration_domain(self) -> IntegrationDomain:
        return self.domain

    def get_integration_name(self) -> str:
        return self.provider_key

    def get_interaction_type(self) -> str:
        return str(self.interaction_type)


class IntegrationWebhookEventType(StrEnum):
    INSTALLATION = "installation"
    PUSH = "push"
    PULL_REQUEST = "pull_request"
    INBOUND_SYNC = "inbound_sync"


@dataclass
class IntegrationWebhookEvent(IntegrationEventLifecycleMetric):
    """An instance to be recorded of a webhook event."""

    interaction_type: IntegrationWebhookEventType
    domain: IntegrationDomain
    provider_key: str

    def get_metrics_domain(self) -> str:
        return "webhook"

    def get_integration_domain(self) -> IntegrationDomain:
        return self.domain

    def get_integration_name(self) -> str:
        return self.provider_key

    def get_interaction_type(self) -> str:
        return str(self.interaction_type)
