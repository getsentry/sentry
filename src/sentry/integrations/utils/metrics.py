import itertools
import logging
from abc import ABC, abstractmethod
from collections.abc import Mapping
from dataclasses import dataclass
from enum import Enum
from types import TracebackType
from typing import Any, Self

from django.conf import settings

from sentry.utils import metrics

logger = logging.getLogger(__name__)


class EventLifecycleOutcome(Enum):
    STARTED = "STARTED"
    HALTED = "HALTED"
    SUCCESS = "SUCCESS"
    FAILURE = "FAILURE"

    def __str__(self) -> str:
        return self.value.lower()


class EventLifecycleMetric(ABC):
    """Information about an event to be measured.

    This class is intended to be used across different integrations that share the
    same business concern. Generally a subclass would represent one business concern
    (such as MessagingInteractionEvent, which extends this class and is used in the
    `slack`, `msteams`, and `discord` integration packages).
    """

    @abstractmethod
    def get_key(self, outcome: EventLifecycleOutcome) -> str:
        """Construct the metrics key that will represent this event.

        It is recommended to implement this method by delegating to a
        `get_standard_key` call.
        """

        raise NotImplementedError

    @staticmethod
    def get_standard_key(
        domain: str,
        integration_name: str,
        interaction_type: str,
        outcome: EventLifecycleOutcome,
        *extra_tokens: str,
    ) -> str:
        """Construct a key with a standard cross-integration structure.

        Implementations of `get_key` generally should delegate to this method in
        order to ensure consistency across integrations.

        :param domain:           a constant string representing the category of business
                                 concern or vertical domain that the integration belongs
                                 to (e.g., "messaging" or "source_code_management")
        :param integration_name: the name of the integration (generally should match a
                                 package name from `sentry.integrations`)
        :param interaction_type: a key representing the category of interaction being
                                 captured (generally should come from an Enum class)
        :param outcome:          the object representing the event outcome
        :param extra_tokens:     additional tokens to add extra context, if needed
        :return: a key to represent the event in metrics or logging
        """

        # For now, universally include an "slo" token to distinguish from any
        # previously existing metrics keys.
        # TODO: Merge with or replace existing keys?
        root_tokens = ("sentry", "integrations", "slo")

        specific_tokens = (domain, integration_name, interaction_type, str(outcome))
        return ".".join(itertools.chain(root_tokens, specific_tokens, extra_tokens))

    def get_extras(self) -> Mapping[str, Any]:
        """Get extra data to log."""
        return {}

    def capture(self, assume_success: bool = True) -> "EventLifecycle":
        """Open a context to measure the event."""
        return EventLifecycle(self, assume_success)


class EventLifecycleStateError(Exception):
    pass


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

    def record_event(
        self, outcome: EventLifecycleOutcome, exc: BaseException | None = None
    ) -> None:
        """Record a starting or halting event.

        This method is public so that unit tests may mock it, but it should be called
        only by the other "record" methods.
        """

        key = self.payload.get_key(outcome)

        sample_rate = (
            1.0 if outcome == EventLifecycleOutcome.FAILURE else settings.SENTRY_METRICS_SAMPLE_RATE
        )
        metrics.incr(key, sample_rate=sample_rate)

        if outcome == EventLifecycleOutcome.FAILURE:
            logger.error(key, extra=self._extra, exc_info=exc)

    def _terminate(
        self, new_state: EventLifecycleOutcome, exc: BaseException | None = None
    ) -> None:
        if self._state is None:
            raise EventLifecycleStateError("The lifecycle has not yet been entered")
        if self._state != EventLifecycleOutcome.STARTED:
            raise EventLifecycleStateError("The lifecycle has already been exited")
        self._state = new_state
        self.record_event(new_state, exc)

    def record_success(self) -> None:
        """Record that the event halted successfully.

        Exiting the context without raising an exception will call this method
        automatically, unless the context was initialized with `assume_success` set
        to False.
        """

        self._terminate(EventLifecycleOutcome.SUCCESS)

    def record_failure(
        self, exc: BaseException | None = None, extra: dict[str, Any] | None = None
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
        self._terminate(EventLifecycleOutcome.FAILURE, exc)

    def __enter__(self) -> Self:
        if self._state is not None:
            raise EventLifecycleStateError("The lifecycle has already been entered")
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


class IntegrationPipelineViewType(Enum):
    """A specific step in an integration's pipeline that is not a static page."""

    # IdentityProviderPipeline
    IDENTITY_PROVIDER = "IDENTITY_PROVIDER"

    # GitHub
    OAUTH_LOGIN = "OAUTH_LOGIN"
    GITHUB_INSTALLATION = "GITHUB_INSTALLATION"

    # Bitbucket
    VERIFY_INSTALLATION = "VERIFY_INSTALLATION"

    # Bitbucket Server
    # OAUTH_LOGIN = "OAUTH_LOGIN"
    OAUTH_CALLBACK = "OAUTH_CALLBACK"

    # Azure DevOps
    ACCOUNT_CONFIG = "ACCOUNT_CONFIG"

    def __str__(self) -> str:
        return self.value.lower()


@dataclass
class IntegrationPipelineViewEvent(EventLifecycleMetric):
    """An instance to be recorded of a user going through an integration pipeline view (step)."""

    interaction_type: IntegrationPipelineViewType
    domain: str
    provider_key: str

    def get_key(self, outcome: EventLifecycleOutcome) -> str:
        # not reporting as SLOs
        root_tokens = ("sentry", "integrations", "installation")
        specific_tokens = (
            self.domain,
            self.provider_key,
            str(self.interaction_type),
            str(outcome),
        )

        return ".".join(itertools.chain(root_tokens, specific_tokens))
