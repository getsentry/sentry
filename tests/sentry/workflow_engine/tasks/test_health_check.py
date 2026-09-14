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
    def test_no_missing_detectors(self) -> None:
        detector = self.create_all_projects_detector(self.organization)

        with override_options(HEALTH_CHECK_OPTIONS), self.tasks():
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

    def test_missing_org_detector(self) -> None:
        assert not Detector.objects.filter(
            project__isnull=True,
            config__organization_id=self.organization.id,
        ).exists()

        with override_options(HEALTH_CHECK_OPTIONS), self.tasks():
            health_check_organization_detectors()

        assert Detector.objects.filter(
            project__isnull=True,
            config__organization_id=self.organization.id,
        ).exists()

    def test_buffer_size_limit(self) -> None:
        organizations = [
            self.organization,
            self.create_organization(),
            self.create_organization(),
        ]
        organization_ids = [organization.id for organization in organizations]

        with (
            override_options(HEALTH_CHECK_OPTIONS),
            mock.patch("sentry.workflow_engine.tasks.health_check.HEALTH_CHECK_BUFFER_SIZE", 2),
            self.tasks(),
        ):
            health_check_organization_detectors()

        assert (
            Detector.objects.filter(
                project__isnull=True,
                config__organization_id__in=organization_ids,
            ).count()
            == 2
        )

    def test_all_projects_detector_option_disabled(self) -> None:
        with (
            override_options({"workflow_engine.tasks.health_check_organization.enabled": True}),
            self.tasks(),
        ):
            health_check_organization_detectors()

        assert not Detector.objects.filter(
            project__isnull=True,
            config__organization_id=self.organization.id,
        ).exists()

    def test_health_check_disabled(self) -> None:
        with (
            override_options({"workflow_engine.auto_creation.all_projects_detector": True}),
            self.tasks(),
        ):
            health_check_organization_detectors()

        assert not Detector.objects.filter(
            project__isnull=True,
            config__organization_id=self.organization.id,
        ).exists()

    def test_inactive_organization_ignored(self) -> None:
        self.organization.update(status=OrganizationStatus.PENDING_DELETION)

        with override_options(HEALTH_CHECK_OPTIONS), self.tasks():
            health_check_organization_detectors()

        assert not Detector.objects.filter(
            project__isnull=True,
            config__organization_id=self.organization.id,
        ).exists()
