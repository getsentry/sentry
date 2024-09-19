from collections.abc import Generator
from contextlib import contextmanager
from dataclasses import dataclass
from enum import Enum
from typing import Any

from sentry.models.organization import Organization
from sentry.organizations.services.organization import RpcOrganization
from sentry.users.models import User
from sentry.users.services.user import RpcUser


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


@dataclass(frozen=True)
class MessagingInteractionEvent:
    """An instance to be recorded of a user interacting through a messaging app."""

    interaction_type: MessagingInteractionType
    provider: str

    # We can cram various optional attributes here if we want to capture them in logs
    user: User | RpcUser | None = None
    organization: Organization | RpcOrganization | None = None

    def get_logging_data(self) -> dict[str, Any]:
        return {
            "interaction_type": self.interaction_type.value,
            "provider": self.provider,
            "user_id": (self.user.id if self.user else None),
            "organization_id": (self.organization.id if self.organization else None),
        }

    def record_start(self) -> None:
        pass  # TODO

    def record_success(self) -> None:
        pass  # TODO

    def record_failure(self, exc: Exception | None = None) -> None:
        pass  # TODO

    @contextmanager
    def capture(self) -> Generator[None, None, None]:
        self.record_start()
        try:
            yield
        except MessagingInteractionException as exc:
            self.record_failure(exc)
            return
        except Exception as exc:
            self.record_failure(exc)
            raise
        else:
            # "Success" may be misleading without further refactoring, as we will
            # reach this point as long as the span closes without raising an
            # exception, even if we caught an exception and/or displayed an error
            # status to the user before returning. See MessagingInteractionException
            # for one potential way to address this.
            self.record_success()


class MessagingInteractionException(Exception):
    """Special exception class that halts a MessagingInteractionEvent span.

    Development note: This is a preliminary idea. The intent is that we would raise
    this exception in cases where we want to record that the interaction failed,
    but we want to soft-fail (display an error status to the user and gracefully
    return) rather than raise a general exception.

    TODO: Either put this into practice or delete it
    """
