from uuid import UUID

from sentry.testutils.cases import TestCase
from sentry.workflow_engine.utils.workflow_context import WorkflowContext, WorkflowContextData


class MockContextualClass:
    def run(self):
        return WorkflowContext.get().detector


class TestWorkflowContextUsage(TestCase):
    def tearDown(self):
        WorkflowContext.reset()

    def test_usage_in_contextual_class(self):
        detector = self.create_detector()
        ctx_data = WorkflowContextData(
            detector=detector,
        )
        WorkflowContext.set(ctx_data)

        mock_cls = MockContextualClass()
        result = mock_cls.run()
        assert result == detector


class TestWorkflowContext(TestCase):
    def tearDown(self):
        WorkflowContext.reset()

    def test_id(self):
        ctx = WorkflowContext.get()
        assert isinstance(ctx.id, UUID)

    def test_id__maintained_after_reset(self):
        stored_id = WorkflowContext.get().id
        WorkflowContext.reset()
        assert stored_id == WorkflowContext.get().id

    def test_set_and_get(self):
        detector = self.create_detector()
        organization = self.organization
        environment = self.create_environment()

        ctx_data = WorkflowContextData(
            detector=detector,
            organization=organization,
            environment=environment,
        )
        WorkflowContext.set(ctx_data)

        ctx = WorkflowContext.get()

        assert ctx.detector == detector
        assert ctx.organization == organization
        assert ctx.environment == environment

    def test_partial_set(self):
        ctx_data = WorkflowContextData(
            organization=self.organization,
        )
        WorkflowContext.set(ctx_data)
        ctx = WorkflowContext.get()

        assert ctx.detector is None
        assert ctx.environment is None
        assert ctx.organization == self.organization

    def test_resetting_context(self):
        detector = self.create_detector()
        organization = self.organization
        environment = self.create_environment()

        ctx_data = WorkflowContextData(
            detector=detector,
            organization=organization,
            environment=environment,
        )
        WorkflowContext.set(ctx_data)

        # Reset context
        WorkflowContext.reset()

        ctx = WorkflowContext.get()

        assert ctx.detector is None
        assert ctx.organization is None
        assert ctx.environment is None
