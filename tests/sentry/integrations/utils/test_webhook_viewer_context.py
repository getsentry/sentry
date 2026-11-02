import pytest

from sentry.integrations.utils.webhook_viewer_context import webhook_viewer_context
from sentry.testutils.cases import TestCase
from sentry.viewer_context import (
    Actor,
    ActorType,
    ViewerContext,
    get_viewer_context,
    viewer_context_scope,
)


class WebhookViewerContextTest(TestCase):
    def test_sets_viewer_context(self):
        with webhook_viewer_context(42):
            ctx = get_viewer_context()
            assert isinstance(ctx, ViewerContext)
            assert ctx.organization_id == 42
            assert ctx.actor.type == ActorType.INTEGRATION
            assert ctx.actor.actor_id is None

        assert get_viewer_context() is None

    def test_restores_existing_context_after_exception(self):
        outer = ViewerContext(actor=Actor(type=ActorType.USER, actor_id=123), organization_id=7)
        with viewer_context_scope(outer):
            with pytest.raises(ValueError), webhook_viewer_context(42):
                ctx = get_viewer_context()
                assert ctx is not None
                assert ctx.actor.type == ActorType.INTEGRATION
                assert ctx.organization_id == 42
                raise ValueError("webhook failed")
            assert get_viewer_context() is outer
