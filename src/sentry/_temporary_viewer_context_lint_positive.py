"""Temporary synthetic fixture for the decision-model lint rule."""

from sentry.viewer_context import Actor, ActorType, ViewerContext


def synthetic_user_job_attribution(origin: ViewerContext) -> ViewerContext:
    """Continue a user-requested job on behalf of its original actor."""
    return ViewerContext(
        actor=Actor(type=ActorType.SYSTEM),
        organization_id=origin.organization_id,
    )
