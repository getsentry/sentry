from unittest import mock

from sentry.signals import organization_created
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options
from sentry.workflow_engine.defaults.detectors import UnableToAcquireLockApiError
from sentry.workflow_engine.defaults.workflows import (
    PULL_REQUEST_WORKFLOW_LABEL,
    ensure_default_organization_workflows,
)
from sentry.workflow_engine.models import DetectorWorkflow, Workflow


class TestCreateOrganizationWorkflows(TestCase):
    def send_signal(self) -> None:
        organization_created.send_robust(
            organization=self.organization, user=self.user, sender=type(self)
        )

    def test_does_not_create_workflow_when_option_disabled(self) -> None:
        self.send_signal()
        assert not Workflow.objects.filter(
            organization=self.organization, name=PULL_REQUEST_WORKFLOW_LABEL
        ).exists()

    @override_options({"workflow_engine.all_projects_auto_creation_enabled": True})
    def test_creates_workflow(self) -> None:
        self.send_signal()
        workflow = Workflow.objects.get(
            organization=self.organization, name=PULL_REQUEST_WORKFLOW_LABEL
        )
        assert workflow.enabled

    @override_options({"workflow_engine.all_projects_auto_creation_enabled": True})
    def test_connects_workflow_to_detector(self) -> None:
        self.send_signal()
        workflow = Workflow.objects.get(
            organization=self.organization, name=PULL_REQUEST_WORKFLOW_LABEL
        )
        assert DetectorWorkflow.objects.filter(workflow=workflow).exists()

    @override_options({"workflow_engine.all_projects_auto_creation_enabled": True})
    def test_no_duplicates_ever(self) -> None:
        # Multiple signal emissions
        self.send_signal()
        self.send_signal()
        # Multiple manual calls
        ensure_default_organization_workflows(self.organization)
        ensure_default_organization_workflows(self.organization)

        assert (
            Workflow.objects.filter(
                organization=self.organization,
                name=PULL_REQUEST_WORKFLOW_LABEL,
            ).count()
            == 1
        )

    @override_options({"workflow_engine.all_projects_auto_creation_enabled": True})
    @mock.patch("sentry.workflow_engine.receivers.organization_workflows.sentry_sdk")
    def test_captures_exception_on_creation_failure(self, mock_sdk: mock.MagicMock) -> None:
        organization = self.create_organization()

        with mock.patch(
            "sentry.workflow_engine.receivers.organization_workflows.ensure_default_organization_workflows",
            side_effect=UnableToAcquireLockApiError,
        ):
            organization_created.send_robust(
                organization=organization, user=self.user, sender=type(self)
            )

        mock_sdk.capture_exception.assert_called_once()
