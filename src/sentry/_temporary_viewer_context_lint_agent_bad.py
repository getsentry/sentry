"""Temporary synthetic fixture for decision-model lint."""

from sentry.viewer_context import Actor, ActorType, ViewerContext


def continue_delegated_job(origin: ViewerContext) -> ViewerContext:
    """Continue the same job on behalf of the original delegated actor."""
    assert origin.actor.type == ActorType.AGENT
    return ViewerContext(
        actor=Actor(type=ActorType.USER, actor_id=origin.actor.delegated_user_id),
        organization_id=origin.organization_id,
    )
