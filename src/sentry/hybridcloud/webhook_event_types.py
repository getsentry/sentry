"""
Recovering the webhook event type from a mailbox name.

Mailbox names are the only place the event type survives once a payload is queued:
reading it back here keeps every webhook metric tagged off the same bounded set of
values, and off the unit delivery actually queues by.
"""

from collections.abc import Mapping

from sentry.integrations.github.webhook_types import CELL_PROCESSED_GITHUB_EVENTS
from sentry.integrations.gitlab.webhook_types import CELL_PROCESSED_GITLAB_EVENTS
from sentry.integrations.types import IntegrationProviderSlug

MAILBOX_EVENT_TYPES: Mapping[str, frozenset[str]] = {
    IntegrationProviderSlug.GITHUB.value: CELL_PROCESSED_GITHUB_EVENTS,
    IntegrationProviderSlug.GITHUB_ENTERPRISE.value: CELL_PROCESSED_GITHUB_EVENTS,
    IntegrationProviderSlug.GITLAB.value: CELL_PROCESSED_GITLAB_EVENTS,
}
"""Every event type a provider's mailbox names may carry; absent means it does not
mailbox by event type. The parser validates against this on the way in,
`event_type_from_mailbox` reads it back out.
"""

NO_EVENT_TYPE = "none"
"""The provider doesn't mailbox by event type — not a parse failure."""

UNKNOWN_EVENT_TYPE = "unknown"
"""The provider does, but this mailbox carries no event type to read."""


def event_type_from_mailbox(provider: str, mailbox_name: str) -> str:
    """
    Recover the event type a mailbox holds, for the providers that encode one.

    A delivery the provider does not mailbox by lands without the suffix, leaving a
    bucket number where this reads, so only known event names are trusted.

    Takes the provider the caller already resolved for its own `provider` tag rather
    than re-deriving it from the mailbox prefix, so the two tags cannot disagree about
    which provider a series belongs to.
    """
    known_event_types = MAILBOX_EVENT_TYPES.get(provider)
    if known_event_types is None:
        return NO_EVENT_TYPE
    suffix = mailbox_name.rpartition(":")[2]
    return suffix if suffix in known_event_types else UNKNOWN_EVENT_TYPE
