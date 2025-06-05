from sentry.testutils.cases import TestCase
from sentry.workflow_engine.utils.workflow_context import WorkflowContext


class MockContextualClass:
    def run(self):
        return WorkflowContext.get_value("detector")


class TestWorkflowContextUsage(TestCase):
    def tearDown(self):
        WorkflowContext.reset()

    def test_usage_in_contextual_class(self):
        detector = self.create_detector()
        WorkflowContext.set(detector=detector)

        mock_cls = MockContextualClass()
        result = mock_cls.run()
        assert result == detector


class TestWorkflowContext(TestCase):
    def tearDown(self):
        WorkflowContext.reset()

    def test_set_and_get(self):
        detector = self.create_detector()
        organization = self.organization
        environment = self.create_environment()

        WorkflowContext.set(
            detector=detector,
            organization=organization,
            environment=environment,
        )

        ctx = WorkflowContext.get()

        assert ctx.detector == detector
        assert ctx.organization == organization
        assert ctx.environment == environment

    def test_partial_set(self):
        WorkflowContext.set(organization=self.organization)

        ctx = WorkflowContext.get()

        assert ctx.detector is None
        assert ctx.environment is None
        assert ctx.organization == self.organization

    def test_resetting_context(self):
        detector = self.create_detector()
        organization = self.organization
        environment = self.create_environment()

        WorkflowContext.set(
            detector=detector,
            organization=organization,
            environment=environment,
        )

        # Reset context
        WorkflowContext.reset()

        ctx = WorkflowContext.get()

        assert ctx.detector is None
        assert ctx.organization is None
        assert ctx.environment is None
