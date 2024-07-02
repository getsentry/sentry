# TODO(hybridcloud) Remove once getsentry usage is updated
from sentry.organizations.services.organization_actions.impl import (
    mark_organization_as_pending_deletion_with_outbox_message,
)

__all__ = ("mark_organization_as_pending_deletion_with_outbox_message",)
