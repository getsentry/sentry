import pytest

from sentry.testutils.cases import TestCase
from sentry.workflow_engine.models.detector import Detector
from sentry.workflow_engine.processors.contexts.workflow_event_context import (
    WorkflowEventContext,
    WorkflowEventContextData,
    isolated_workflow_event_context,
)


class WorkflowEventContextTestCase(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.enterContext(isolated_workflow_event_context())


class MockContextualClass:
    def run(self) -> Detector | None:
        return WorkflowEventContext.get().detector


class TestWorkflowEventContextUsage(WorkflowEventContextTestCase):
    def test_usage_in_contextual_class(self) -> None:
        detector = self.create_detector()
        ctx_data = WorkflowEventContextData(
            detector=detector,
        )
        WorkflowEventContext.set(ctx_data)

        mock_cls = MockContextualClass()
        result = mock_cls.run()
        assert result == detector


class TestWorkflowEventContext(WorkflowEventContextTestCase):
    def test_set_and_get(self) -> None:
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

    def test_partial_set(self) -> None:
        ctx_data = WorkflowEventContextData(
            organization=self.organization,
        )
        WorkflowEventContext.set(ctx_data)
        ctx = WorkflowEventContext.get()

        assert ctx.detector is None
        assert ctx.environment is None
        assert ctx.organization == self.organization

    def test_resetting_context(self) -> None:
        detector = self.create_detector()
        organization = self.organization
        environment = self.create_environment()

        token = WorkflowEventContext.set(
            WorkflowEventContextData(
                detector=detector,
                organization=organization,
                environment=environment,
            )
        )

        # Reset context
        WorkflowEventContext.reset(token)

        ctx = WorkflowEventContext.get()

        assert ctx.detector is None
        assert ctx.organization is None
        assert ctx.environment is None

    def test_isolated_context_restores_previous_context(self) -> None:
        previous_context = WorkflowEventContextData(organization=self.organization)
        WorkflowEventContext.set(previous_context)

        with isolated_workflow_event_context():
            assert WorkflowEventContext.get() == WorkflowEventContextData()
            WorkflowEventContext.set(WorkflowEventContextData(detector=self.create_detector()))

        assert WorkflowEventContext.get() is previous_context

    def test_isolated_context_restores_previous_context_on_exception(self) -> None:
        previous_context = WorkflowEventContextData(organization=self.organization)
        WorkflowEventContext.set(previous_context)

        with pytest.raises(ValueError, match="workflow failed"):
            with isolated_workflow_event_context():
                WorkflowEventContext.set(WorkflowEventContextData(detector=self.create_detector()))
                raise ValueError("workflow failed")

        assert WorkflowEventContext.get() is previous_context

    def test_nested_isolated_contexts(self) -> None:
        previous_context = WorkflowEventContextData(organization=self.organization)
        WorkflowEventContext.set(previous_context)
        inner_context = WorkflowEventContextData(detector=self.create_detector())

        with isolated_workflow_event_context():
            WorkflowEventContext.set(inner_context)
            with isolated_workflow_event_context():
                assert WorkflowEventContext.get() == WorkflowEventContextData()
                WorkflowEventContext.set(
                    WorkflowEventContextData(environment=self.create_environment())
                )

            assert WorkflowEventContext.get() is inner_context

        assert WorkflowEventContext.get() is previous_context
