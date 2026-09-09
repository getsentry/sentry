from unittest import mock

from sentry.grouping.grouptype import ErrorGroupType
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options
from sentry.workflow_engine.models import Detector
from sentry.workflow_engine.tasks.health_check import (
    health_check_organization_detectors,
    health_check_project_detectors,
)
from sentry.workflow_engine.typings.grouptype import IssueStreamGroupType


class TestHealthCheckOrganizationDetectors(TestCase):
    @override_options(
        {
            "workflow_engine.auto_creation.all_projects_detector": True,
            "workflow_engine.tasks.health_check_organization.enabled": True,
        }
    )
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

    @override_options(
        {
            "workflow_engine.auto_creation.all_projects_detector": True,
            "workflow_engine.tasks.health_check_organization.enabled": True,
        }
    )
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

    @override_options(
        {
            "workflow_engine.auto_creation.all_projects_detector": True,
            "workflow_engine.tasks.health_check_organization.enabled": True,
        }
    )
    def test_buffer_size_limit(self) -> None:
        second_organization = self.create_organization()
        third_organization = self.create_organization()
        Detector.objects.filter(
            project__isnull=True,
            config__organization_id__in=(
                self.organization.id,
                second_organization.id,
                third_organization.id,
            ),
        ).delete()

        with (
            mock.patch("sentry.workflow_engine.tasks.health_check.HEALTH_CHECK_BUFFER_SIZE", 2),
            self.tasks(),
        ):
            health_check_organization_detectors()

        assert (
            Detector.objects.filter(
                project__isnull=True,
                config__organization_id__in=(
                    self.organization.id,
                    second_organization.id,
                    third_organization.id,
                ),
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


class TestHealthCheckProjectDetectors(TestCase):
    @override_options({"workflow_engine.tasks.health_check_project.enabled": True})
    def test_no_missing_detectors(self) -> None:
        with self.tasks():
            health_check_project_detectors()

        assert (
            Detector.objects.filter(
                project=self.project,
                type__in=(ErrorGroupType.slug, IssueStreamGroupType.slug),
            ).count()
            == 2
        )

    @override_options({"workflow_engine.tasks.health_check_project.enabled": True})
    def test_missing_project_detector(self) -> None:
        Detector.objects.filter(project=self.project, type=ErrorGroupType.slug).delete()

        with self.tasks():
            health_check_project_detectors()

        assert Detector.objects.filter(
            project=self.project,
            type=ErrorGroupType.slug,
        ).exists()

    @override_options({"workflow_engine.tasks.health_check_project.enabled": True})
    def test_buffer_size_limit(self) -> None:
        second_project = self.create_project(organization=self.organization)
        third_project = self.create_project(organization=self.organization)
        Detector.objects.filter(
            project__in=(self.project, second_project, third_project), type=ErrorGroupType.slug
        ).delete()

        with (
            mock.patch("sentry.workflow_engine.tasks.health_check.HEALTH_CHECK_BUFFER_SIZE", 2),
            self.tasks(),
        ):
            health_check_project_detectors()

        assert (
            Detector.objects.filter(
                project__in=(self.project, second_project, third_project),
                type=ErrorGroupType.slug,
            ).count()
            == 2
        )

    def test_health_check_disabled(self) -> None:
        Detector.objects.filter(project=self.project, type=ErrorGroupType.slug).delete()

        with self.tasks():
            health_check_project_detectors()

        assert not Detector.objects.filter(
            project=self.project,
            type=ErrorGroupType.slug,
        ).exists()
