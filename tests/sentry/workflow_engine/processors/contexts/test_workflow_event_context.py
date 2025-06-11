from sentry.testutils.cases import TestCase
from sentry.workflow_engine.processors.contexts.workflow_event_context import (
    WorkflowEventContext,
    WorkflowEventContextData,
)


class WorkflowEventContextTestCase(TestCase):
    def setUp(self):
        super().setUp()
        self.ctx_token = None

    def tearDown(self):
        if self.ctx_token:
            WorkflowEventContext.reset(self.ctx_token)
            self.ctx_token = None


class MockContextualClass:
    def run(self):
        return WorkflowEventContext.get().detector


class TestWorkflowEventContextUsage(WorkflowEventContextTestCase):
    def test_usage_in_contextual_class(self):
        detector = self.create_detector()
        ctx_data = WorkflowEventContextData(
            detector=detector,
        )
        self.ctx_token = WorkflowEventContext.set(ctx_data)

        mock_cls = MockContextualClass()
        result = mock_cls.run()
        assert result == detector


class TestWorkflowEventContext(WorkflowEventContextTestCase):
    def test_set_and_get(self):
        detector = self.create_detector()
        organization = self.organization
        environment = self.create_environment()

        ctx_data = WorkflowEventContextData(
            detector=detector,
            organization=organization,
            environment=environment,
        )
        WorkflowEventContext.set(ctx_data)

        ctx = WorkflowEventContext.get()

        assert ctx.detector == detector
        assert ctx.organization == organization
        assert ctx.environment == environment

    def test_partial_set(self):
        ctx_data = WorkflowEventContextData(
            organization=self.organization,
        )
        self.ctx_token = WorkflowEventContext.set(ctx_data)
        ctx = WorkflowEventContext.get()

        assert ctx.detector is None
        assert ctx.environment is None
        assert ctx.organization == self.organization

    def test_resetting_context(self):
        detector = self.create_detector()
        organization = self.organization
        environment = self.create_environment()

        self.ctx_token = WorkflowEventContext.set(
            WorkflowEventContextData(
                detector=detector,
                organization=organization,
                environment=environment,
            )
        )

        # Reset context
        WorkflowEventContext.reset(self.ctx_token)
        self.ctx_token = None

        ctx = WorkflowEventContext.get()

        assert ctx.detector is None
        assert ctx.organization is None
        assert ctx.environment is None
