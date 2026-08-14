"""
Recovering the webhook event type from a mailbox name.

Mailbox names are the only place the event type survives once a payload is queued:
reading it back here keeps every webhook metric tagged off the same bounded set of
values, and off the unit delivery actually queues by.
"""

from sentry.integrations.github.webhook_types import CELL_PROCESSED_GITHUB_EVENTS
from sentry.integrations.types import IntegrationProviderSlug

_EVENT_TYPED_MAILBOX_PROVIDERS = frozenset(
    {IntegrationProviderSlug.GITHUB.value, IntegrationProviderSlug.GITHUB_ENTERPRISE.value}
)
"""Providers whose parser appends the event type to the mailbox name."""

NO_EVENT_TYPE = "none"
"""The provider doesn't mailbox by event type — not a parse failure."""

UNKNOWN_EVENT_TYPE = "unknown"
"""The provider does, but this mailbox carries no event type to read."""


def event_type_from_mailbox(provider: str, mailbox_name: str) -> str:
    """
    Recover the event type a mailbox holds, for the providers that encode one.

    A delivery with no `X-GitHub-Event` header mailboxes without the suffix, leaving a
    bucket number where this reads, so only known event names are trusted.

    Takes the provider the caller already resolved for its own `provider` tag rather
    than re-deriving it from the mailbox prefix, so the two tags cannot disagree about
    which provider a series belongs to.
    """
    if provider not in _EVENT_TYPED_MAILBOX_PROVIDERS:
        return NO_EVENT_TYPE
    suffix = mailbox_name.rpartition(":")[2]
    return suffix if suffix in CELL_PROCESSED_GITHUB_EVENTS else UNKNOWN_EVENT_TYPE
