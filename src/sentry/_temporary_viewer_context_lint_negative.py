"""Temporary synthetic fixture for the decision-model lint rule."""

from sentry.viewer_context import Actor, ActorType, ViewerContext


def synthetic_scheduled_cleanup_attribution() -> ViewerContext:
    """Start independent, Sentry-scheduled cleanup."""
    return ViewerContext(actor=Actor(type=ActorType.SYSTEM))
