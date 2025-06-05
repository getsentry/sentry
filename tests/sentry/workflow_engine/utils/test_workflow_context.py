from sentry.testutils.cases import TestCase
from sentry.workflow_engine.utils.workflow_context import WorkflowContext


class MockContextualClass:
    def run(self):
        return WorkflowContext.get_value("detector")


class TestWorkflowContextUsage(TestCase):
    def setUp(self):
        self.workflow_context = WorkflowContext()

    def test_usage_in_contextual_class(self):
        detector = self.create_detector()
        self.workflow_context.set(detector=detector)

        mock_cls = MockContextualClass()
        result = mock_cls.run()
        assert result == detector


class TestWorkflowContext(TestCase):
    def setUp(self):
        self.workflow_context = WorkflowContext()

    def test_set_and_get(self):
        detector = self.create_detector()
        organization = self.organization
        environment = self.create_environment()

        self.workflow_context.set(
            detector=detector,
            organization=organization,
            environment=environment,
        )

        ctx = self.workflow_context.get()

        assert ctx.detector == detector
        assert ctx.organization == organization
        assert ctx.environment == environment

    def test_partial_set(self):
        self.workflow_context.set(organization=self.organization)

        ctx = self.workflow_context.get()

        assert ctx.detector is None
        assert ctx.environment is None
        assert ctx.organization == self.organization

    def test_resetting_context(self):
        detector = self.create_detector()
        organization = self.organization
        environment = self.create_environment()

        self.workflow_context.set(
            detector=detector,
            organization=organization,
            environment=environment,
        )

        # Reset context
        self.workflow_context.reset()

        ctx = self.workflow_context.get()

        assert ctx.detector is None
        assert ctx.organization is None
        assert ctx.environment is None
