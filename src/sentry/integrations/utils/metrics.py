import logging
import random
from abc import ABC, abstractmethod
from collections.abc import Mapping
from dataclasses import dataclass
from enum import StrEnum
from types import TracebackType
from typing import Any, Self

import sentry_sdk

from sentry.exceptions import RestrictedIPAddress
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

    def capture(
        self, assume_success: bool = True, sample_log_rate: float = 1.0
    ) -> "EventLifecycle":
        """Open a context to measure the event."""
        return EventLifecycle(self, assume_success, sample_log_rate)


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

    def capture(
        self, assume_success: bool = True, sample_log_rate: float = 1.0
    ) -> "IntegrationEventLifecycle":
        return IntegrationEventLifecycle(self, assume_success, sample_log_rate)


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

    def __init__(
        self,
        payload: EventLifecycleMetric,
        assume_success: bool = True,
        sample_log_rate: float = 1.0,
    ) -> None:
        self.payload = payload
        self.assume_success = assume_success
        self.sample_log_rate = sample_log_rate
        self._state: EventLifecycleOutcome | None = None
        self._extra = dict(self.payload.get_extras())

    def get_state(self) -> EventLifecycleOutcome | None:
        return self._state

    def add_extra(self, name: str, value: Any) -> None:
        """Add a value to logged "extra" data.

        Overwrites the name with a new value if it was previously used.
        """
        self._extra[name] = value

    def add_extras(self, extras: Mapping[str, Any]) -> None:
        """Add multiple values to logged "extra" data."""
        self._extra.update(extras)

    def record_event(
        self,
        outcome: EventLifecycleOutcome,
        outcome_reason: BaseException | str | None = None,
        create_issue: bool = False,
        sample_log_rate: float | None = None,
    ) -> None:
        """Record a starting or halting event.

        This method is public so that unit tests may mock it, but it should be called
        only by the other "record" methods.
        """

        key = self.payload.get_metric_key(outcome)
        tags = self.payload.get_metric_tags()

        sample_rate = 1.0
        metrics.incr(key, tags=tags, sample_rate=sample_rate)

        sentry_sdk.set_tags(tags)

        extra = dict(self._extra)
        extra.update(tags)
        log_params: dict[str, Any] = {
            "extra": extra,
        }

        if isinstance(outcome_reason, BaseException):
            # Capture exception in Sentry if create_issue is True
            if create_issue:
                # If the outcome is halted, we want to set the level to warning
                if outcome == EventLifecycleOutcome.HALTED:
                    sentry_sdk.set_level("warning")

                event_id = sentry_sdk.capture_exception(
                    outcome_reason,
                )

                log_params["extra"]["slo_event_id"] = event_id

            # Add exception summary but don't include full stack trace in logs
            # TODO(iamrajjoshi): Phase this out once everyone is comfortable with just using the sentry issue
            log_params["extra"]["exception_summary"] = repr(outcome_reason)
        elif isinstance(outcome_reason, str):
            extra["outcome_reason"] = outcome_reason

        if outcome == EventLifecycleOutcome.FAILURE or outcome == EventLifecycleOutcome.HALTED:
            # Use provided sample_log_rate or fall back to instance default
            effective_sample_log_rate = (
                sample_log_rate if sample_log_rate is not None else self.sample_log_rate
            )

            should_log = (
                effective_sample_log_rate >= 1.0 or random.random() < effective_sample_log_rate
            )
            if should_log:
                if outcome == EventLifecycleOutcome.FAILURE:
                    logger.warning(key, **log_params)
                elif outcome == EventLifecycleOutcome.HALTED:
                    logger.info(key, **log_params)

    @staticmethod
    def _report_flow_error(message) -> None:
        logger.error("EventLifecycle flow error: %s", message)

    def _terminate(
        self,
        new_state: EventLifecycleOutcome,
        outcome_reason: BaseException | str | None = None,
        create_issue: bool = False,
        sample_log_rate: float | None = None,
    ) -> None:
        if self._state is None:
            self._report_flow_error("The lifecycle has not yet been entered")
        if self._state != EventLifecycleOutcome.STARTED:
            self._report_flow_error("The lifecycle has already been exited")
        self._state = new_state
        self.record_event(new_state, outcome_reason, create_issue, sample_log_rate)

    def record_success(self) -> None:
        """Record that the event halted successfully.

        Exiting the context without raising an exception will call this method
        automatically, unless the context was initialized with `assume_success` set
        to False.
        """

        self._terminate(EventLifecycleOutcome.SUCCESS)

    def record_failure(
        self,
        failure_reason: BaseException | str | None = None,
        extra: dict[str, Any] | None = None,
        create_issue: bool = True,
        sample_log_rate: float | None = None,
    ) -> None:
        """Record that the event halted in failure. Additional data may be passed
        to be logged.

        Calling it means that the feature is broken and requires immediate attention.

        An error will be reported to Sentry if create_issue is True (default).
        The default is True because we want to create an issue for all failures
        because it will provide a stack trace and help us debug the issue.
        There needs to be a compelling reason to not create an issue for a failure

        There is no need to call this method directly if an exception is raised from
        inside the context. It will be called automatically when exiting the context
        on an exception.

        This method should be called if we return a soft failure from the event. For
        example, if we receive an error status from a remote service and gracefully
        display an error response to the user, it would be necessary to manually call
        `record_failure` on the context object.

        Args:
            failure_reason: The reason for the failure (exception or string)
            extra: Additional data to include in logs
            create_issue: Whether to create a Sentry issue (default True)
            sample_log_rate: Rate at which to sample logs (0.0-1.0). If None, uses instance default.
        """

        if extra:
            self._extra.update(extra)
        self._terminate(
            EventLifecycleOutcome.FAILURE, failure_reason, create_issue, sample_log_rate
        )

    def record_halt(
        self,
        halt_reason: BaseException | str | None = None,
        extra: dict[str, Any] | None = None,
        create_issue: bool = False,
        sample_log_rate: float | None = None,
    ) -> None:
        """Record that the event halted in an ambiguous state.

        It will be logged to GCP but no Sentry error will be reported by default.
        The default is False because we don't want to create an issue for all halts.
        However for certain debugging cases, we may want to create an issue.

        This method can be called in response to a sufficiently ambiguous exception
        or other error condition, where it may have been caused by a user error or
        other expected condition, but there is some substantial chance that it
        represents a bug.

        Set create_issue=True if you want to create a Sentry issue for this halt.

        Such cases usually mean that we want to:
          (1) document the ambiguity;
          (2) monitor it for sudden spikes in frequency; and
          (3) investigate whether more detailed error information is available
              (but probably later, as a backlog item).

        Args:
            halt_reason: The reason for the halt (exception or string)
            extra: Additional data to include in logs
            create_issue: Whether to create a Sentry issue (default False)
            sample_log_rate: Rate at which to sample logs (0.0-1.0). If None, uses instance default.
        """

        if extra:
            self._extra.update(extra)
        self._terminate(EventLifecycleOutcome.HALTED, halt_reason, create_issue, sample_log_rate)

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
            # Default to creating a Sentry issue for unhandled exceptions
            self.record_failure(exc_value, create_issue=True)
        else:
            # We exited the context without record_success or record_failure being
            # called. Assume success if we were told to do so. Else, log a halt
            # indicating that there is no clear success or failure signal.
            self._terminate(
                EventLifecycleOutcome.SUCCESS
                if self.assume_success
                else EventLifecycleOutcome.HALTED
            )


class IntegrationEventLifecycle(EventLifecycle):
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

        if exc_value is not None and isinstance(exc_value.__cause__, RestrictedIPAddress):
            # ApiHostError is raised from RestrictedIPAddress
            self.record_halt(exc_value)
            return
        super().__exit__(exc_type, exc_value, traceback)


class IntegrationPipelineViewType(StrEnum):
    """A specific step in an integration's pipeline that is not a static page."""

    # IdentityPipeline
    IDENTITY_LOGIN = "identity_login"
    IDENTITY_LINK = "identity_link"
    TOKEN_EXCHANGE = "token_exchange"

    # GitHub
    OAUTH_LOGIN = "oauth_login"
    GITHUB_INSTALLATION = "github_installation"
    ORGANIZATION_SELECTION = "organization_selection"

    # Bitbucket
    VERIFY_INSTALLATION = "verify_installation"

    # Bitbucket Server
    # OAUTH_LOGIN = "OAUTH_LOGIN"
    OAUTH_CALLBACK = "oauth_callback"

    # Azure DevOps
    ACCOUNT_CONFIG = "account_config"

    # Jira Server
    WEBHOOK_CREATION = "webhook_creation"

    # All Integrations
    FINISH_PIPELINE = "finish_pipeline"

    # Opsgenie
    INSTALLATION_CONFIGURATION = "installation_configuration"


class IntegrationPipelineErrorReason(StrEnum):
    # OAuth identity
    TOKEN_EXCHANGE_ERROR = "token_exchange_error"
    TOKEN_EXCHANGE_MISMATCHED_STATE = "token_exchange_mismatched_state"


class IntegrationPipelineHaltReason(StrEnum):
    # OAuth identity
    NO_CODE_PROVIDED = "no_code_provided"

    # VSTS
    NO_ACCOUNTS = "no_accounts"


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
    PULL_REQUEST_REVIEW = "pull_request_review"
    PULL_REQUEST_REVIEW_COMMENT = "pull_request_review_comment"
    # This represents a webhook event for an inbound sync operation, such as syncing external resources or data into Sentry.
    INBOUND_SYNC = "inbound_sync"
    ISSUE_COMMENT = "issue_comment"
    CHECK_RUN = "check_run"


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


class IntegrationProxyEventType(StrEnum):
    """An instance to be recorded of a integration proxy event."""

    SHOULD_PROXY = "should_proxy"
    PROXY_REQUEST = "proxy_request"


@dataclass
class IntegrationProxyEvent(EventLifecycleMetric):
    """An instance to be recorded of a integration proxy event."""

    interaction_type: IntegrationProxyEventType

    def get_metrics_domain(self) -> str:
        return "integration_proxy"

    def get_interaction_type(self) -> str:
        return str(self.interaction_type)

    def get_metric_key(self, outcome: EventLifecycleOutcome) -> str:
        tokens = (self.get_metrics_domain(), self.interaction_type, str(outcome))
        return ".".join(tokens)

    def get_metric_tags(self) -> Mapping[str, str]:
        return {
            "interaction_type": self.interaction_type,
        }

    def get_extras(self) -> Mapping[str, Any]:
        return {
            "interaction_type": self.interaction_type,
        }
