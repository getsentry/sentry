"""Temporary synthetic fixture for decision-model lint."""

from sentry.viewer_context import ViewerContext


def continue_delegated_job(origin: ViewerContext) -> ViewerContext:
    """Continue the same job on behalf of the original delegated actor."""
    return ViewerContext(actor=origin.actor, organization_id=origin.organization_id)
