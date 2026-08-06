from unittest import mock

from sentry.signals import organization_created
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options
from sentry.workflow_engine.defaults.detectors import (
    UnableToAcquireLockApiError,
    ensure_default_organization_detectors,
)
from sentry.workflow_engine.models import Detector
from sentry.workflow_engine.typings.grouptype import IssueStreamGroupType


class TestCreateOrganizationDetectors(TestCase):
    def send_signal(self) -> None:
        organization_created.send_robust(
            organization=self.organization,
            user=self.user,
            sender=type(self),
        )

    def test_does_not_create_detector_when_option_disabled(self) -> None:
        self.send_signal()
        assert not Detector.objects.filter(
            type=IssueStreamGroupType.slug,
            project__isnull=True,
            config__organization_id=self.organization.id,
        ).exists()

    @override_options({"workflow_engine.all_projects_auto_creation_enabled": True})
    def test_creates_detector(self) -> None:
        self.send_signal()
        detector = Detector.objects.get(
            type=IssueStreamGroupType.slug,
            project__isnull=True,
            config__organization_id=self.organization.id,
        )
        assert detector.enabled

    @override_options({"workflow_engine.all_projects_auto_creation_enabled": True})
    def test_no_duplicates_ever(self) -> None:
        # Multiple signal emissions
        self.send_signal()
        self.send_signal()
        # Multiple manual calls
        ensure_default_organization_detectors(self.organization)
        ensure_default_organization_detectors(self.organization)

        assert (
            Detector.objects.filter(
                type=IssueStreamGroupType.slug,
                project__isnull=True,
                config__organization_id=self.organization.id,
            ).count()
            == 1
        )

    @override_options({"workflow_engine.all_projects_auto_creation_enabled": True})
    @mock.patch("sentry.workflow_engine.receivers.organization_detectors.sentry_sdk")
    def test_captures_exception_on_creation_failure(self, mock_sdk: mock.MagicMock) -> None:
        organization = self.create_organization()

        with mock.patch(
            "sentry.workflow_engine.receivers.organization_detectors.ensure_default_organization_detectors",
            side_effect=UnableToAcquireLockApiError,
        ):
            organization_created.send_robust(
                organization=organization, user=self.user, sender=type(self)
            )

        mock_sdk.capture_exception.assert_called_once()
