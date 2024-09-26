from dataclasses import dataclass
from enum import Enum
from types import TracebackType
from typing import Any

from django.conf import settings

from sentry.models.organization import Organization
from sentry.organizations.services.organization import RpcOrganization
from sentry.users.models import User
from sentry.users.services.user import RpcUser
from sentry.utils import metrics


class MessagingInteractionType(Enum):
    """A way in which a user can interact with Sentry through a messaging app."""

    # General interactions
    HELP = "HELP"
    LINK_IDENTITY = "LINK_IDENTITY"
    UNLINK_IDENTITY = "UNLINK_IDENTITY"
    LINK_TEAM = "LINK_TEAM"
    UNLINK_TEAM = "UNLINK_TEAM"

    # Interactions on Issues
    STATUS = "STATUS"
    ARCHIVE_DIALOG = "ARCHIVE_DIALOG"
    ARCHIVE = "ARCHIVE"
    ASSIGN_DIALOG = "ASSIGN_DIALOG"
    ASSIGN = "ASSIGN"
    UNASSIGN = "ASSIGN"
    RESOLVE_DIALOG = "RESOLVE_DIALOG"
    RESOLVE = "RESOLVE"
    UNRESOLVE = "UNRESOLVE"
    IGNORE = "IGNORE"
    MARK_ONGOING = "MARK_ONGOING"


class MessagingInteractionEventStateError(Exception):
    pass


@dataclass
class MessagingInteractionEvent:
    """An instance to be recorded of a user interacting through a messaging app."""

    interaction_type: MessagingInteractionType
    provider: str

    # We can cram various optional attributes here if we want to capture them in logs
    user: User | RpcUser | None = None
    organization: Organization | RpcOrganization | None = None

    def __post_init__(self) -> None:
        self._has_started = False
        self._has_halted = False
        self._has_failed = False

    def _get_logging_data(self) -> dict[str, Any]:
        return {
            "interaction_type": self.interaction_type.value,
            "provider": self.provider,
            "user_id": (self.user.id if self.user else None),
            "organization_id": (self.organization.id if self.organization else None),
        }

    def _record_event(
        self, event_type: str, sample_rate: float = settings.SENTRY_METRICS_SAMPLE_RATE
    ) -> None:
        tag_tokens = ["sentry", "integrations", "messaging", "slo"] + [
            self.provider,
            str(self.interaction_type).lower(),
            event_type,
        ]
        tag = ".".join(tag_tokens)
        metrics.incr(tag, sample_rate=sample_rate)

    def record_start(self) -> None:
        if self._has_started:
            raise MessagingInteractionEventStateError("This context has already been entered")
        self._has_started = True

        self._record_event("start")

    def record_success(self) -> None:
        if not self._has_started:
            raise MessagingInteractionEventStateError("This context has not yet been entered")
        if self._has_halted or self._has_failed:
            raise MessagingInteractionEventStateError("This context has already been exited")
        self._has_halted = True

        # As an intermediately shippable state, record a "halt" until we're confident
        # we're calling `record_failure` on all soft failure conditions. Then we can
        # change it to "success".
        self._record_event("halt")

    def record_failure(self, exc: BaseException | None = None) -> None:
        if not self._has_started:
            raise MessagingInteractionEventStateError("This context has not yet been entered")
        if self._has_halted or self._has_failed:
            raise MessagingInteractionEventStateError("This context has already been exited")
        self._has_failed = True

        self._record_event("failure", sample_rate=1.0)

    def __enter__(self) -> None:
        self.record_start()

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc_value: BaseException | None,
        traceback: TracebackType,
    ) -> None:
        if exc_value is not None:
            self.record_failure(exc_value)
        elif not self._has_failed:
            self.record_success()
