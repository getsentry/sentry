"""Temporary synthetic fixture for decision-model lint."""

from sentry.viewer_context import Actor, ActorType, ViewerContext


def continue_authenticated_job(origin: ViewerContext) -> ViewerContext:
    """Continue a user-requested job on behalf of its authenticated actor."""
    assert origin.actor.type == ActorType.USER
    return ViewerContext(
        actor=Actor(type=ActorType.UNKNOWN),
        organization_id=origin.organization_id,
    )
