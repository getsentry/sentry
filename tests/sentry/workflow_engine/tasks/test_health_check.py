from unittest import mock

from sentry.models.organization import OrganizationStatus
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options
from sentry.workflow_engine.models import Detector
from sentry.workflow_engine.tasks.health_check import health_check_organization_detectors

HEALTH_CHECK_OPTIONS = {
    "workflow_engine.auto_creation.all_projects_detector": True,
    "workflow_engine.tasks.health_check_organization.enabled": True,
}


class TestHealthCheckOrganizationDetectors(TestCase):
    @override_options(HEALTH_CHECK_OPTIONS)
    def test_no_missing_detectors(self) -> None:
        detector = self.create_all_projects_detector(self.organization)

        with self.tasks():
            health_check_organization_detectors()

        assert Detector.objects.filter(
            id=detector.id,
            project__isnull=True,
            config__organization_id=self.organization.id,
        ).exists()
        assert (
            Detector.objects.filter(
                project__isnull=True,
                config__organization_id=self.organization.id,
            ).count()
            == 1
        )

    @override_options(HEALTH_CHECK_OPTIONS)
    def test_missing_org_detector(self) -> None:
        assert not Detector.objects.filter(
            project__isnull=True,
            config__organization_id=self.organization.id,
        ).exists()

        with self.tasks():
            health_check_organization_detectors()

        assert Detector.objects.filter(
            project__isnull=True,
            config__organization_id=self.organization.id,
        ).exists()

    @override_options(HEALTH_CHECK_OPTIONS)
    @mock.patch(
        "sentry.workflow_engine.tasks.health_check.ensure_default_detectors_for_organization"
    )
    def test_org_with_existing_detector_not_dispatched(self, mock_task: mock.Mock) -> None:
        self.create_all_projects_detector(self.organization)
        org_without_detector = self.create_organization()

        health_check_organization_detectors()

        mock_task.delay.assert_called_with(organization_id=org_without_detector.id)
        assert mock.call(organization_id=self.organization.id) not in mock_task.delay.call_args_list

    @override_options(HEALTH_CHECK_OPTIONS)
    @mock.patch("sentry.workflow_engine.tasks.health_check.HEALTH_CHECK_BUFFER_SIZE", 2)
    def test_buffer_size_limit(self) -> None:
        organizations = [self.organization, self.create_organization(), self.create_organization()]
        organization_ids = [organization.id for organization in organizations]

        with self.tasks():
            health_check_organization_detectors()

        assert (
            Detector.objects.filter(
                project__isnull=True,
                config__organization_id__in=organization_ids,
            ).count()
            == 2
        )

    @override_options({"workflow_engine.tasks.health_check_organization.enabled": True})
    def test_all_projects_detector_option_disabled(self) -> None:
        with self.tasks():
            health_check_organization_detectors()

        assert not Detector.objects.filter(
            project__isnull=True,
            config__organization_id=self.organization.id,
        ).exists()

    @override_options({"workflow_engine.auto_creation.all_projects_detector": True})
    def test_health_check_disabled(self) -> None:
        with self.tasks():
            health_check_organization_detectors()

        assert not Detector.objects.filter(
            project__isnull=True,
            config__organization_id=self.organization.id,
        ).exists()

    @override_options(HEALTH_CHECK_OPTIONS)
    def test_inactive_organization_ignored(self) -> None:
        self.organization.update(status=OrganizationStatus.PENDING_DELETION)

        with self.tasks():
            health_check_organization_detectors()

        assert not Detector.objects.filter(
            project__isnull=True,
            config__organization_id=self.organization.id,
        ).exists()
