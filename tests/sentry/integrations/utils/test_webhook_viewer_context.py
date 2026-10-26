from django.test import override_settings

from sentry.integrations.utils.webhook_viewer_context import webhook_viewer_context
from sentry.testutils.cases import TestCase
from sentry.viewer_context import ActorType, ViewerContext, get_viewer_context


class WebhookViewerContextTest(TestCase):
    @override_settings(SENTRY_VIEWER_CONTEXT_ENABLED=True)
    def test_sets_viewer_context_when_enabled(self):
        with webhook_viewer_context(42):
            ctx = get_viewer_context()
            assert isinstance(ctx, ViewerContext)
            assert ctx.organization_id == 42
            assert ctx.actor.type == ActorType.INTEGRATION
            assert ctx.actor.actor_id is None

        assert get_viewer_context() is None

    @override_settings(SENTRY_VIEWER_CONTEXT_ENABLED=False)
    def test_noop_when_disabled(self):
        with webhook_viewer_context(42):
            assert get_viewer_context() is None
