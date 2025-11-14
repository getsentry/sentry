from typing import int
from sentry.integrations.models.data_forwarder import DataForwarder
from sentry.integrations.models.data_forwarder_project import DataForwarderProject
from sentry.signals import project_created
from sentry.testutils.cases import TestCase


class DataForwardingReceiverTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization()
        self.project = self.create_project(organization=self.organization)

    def test_auto_enrollment_when_enroll_new_projects_enabled(self) -> None:
        data_forwarder = DataForwarder.objects.create(
            organization=self.organization,
            is_enabled=True,
            enroll_new_projects=True,
            provider="segment",
            config={"write_key": "test_key"},
        )

        new_project = self.create_project(organization=self.organization, fire_project_created=True)

        enrollment = DataForwarderProject.objects.filter(
            data_forwarder=data_forwarder, project=new_project
        ).first()
        assert enrollment is not None
        assert enrollment.is_enabled is True
        assert enrollment.overrides == {}

    def test_no_enrollment_when_enroll_new_projects_disabled(self) -> None:
        data_forwarder = DataForwarder.objects.create(
            organization=self.organization,
            is_enabled=True,
            enroll_new_projects=False,
            provider="segment",
            config={"write_key": "test_key"},
        )

        new_project = self.create_project(organization=self.organization, fire_project_created=True)

        # Verify the project was not enrolled
        enrollment = DataForwarderProject.objects.filter(
            data_forwarder=data_forwarder, project=new_project
        ).first()
        assert enrollment is None

    def test_no_enrollment_when_data_forwarder_disabled(self) -> None:
        data_forwarder = DataForwarder.objects.create(
            organization=self.organization,
            is_enabled=False,
            enroll_new_projects=True,
            provider="segment",
            config={"write_key": "test_key"},
        )

        new_project = self.create_project(organization=self.organization, fire_project_created=True)

        enrollment = DataForwarderProject.objects.filter(
            data_forwarder=data_forwarder, project=new_project
        ).first()
        assert enrollment is None

    def test_no_duplicate_enrollment_when_project_already_enrolled(self) -> None:
        data_forwarder = DataForwarder.objects.create(
            organization=self.organization,
            is_enabled=True,
            enroll_new_projects=True,
            provider="segment",
            config={"write_key": "test_key"},
        )

        DataForwarderProject.objects.create(
            data_forwarder=data_forwarder,
            project=self.project,
            is_enabled=True,
            overrides={"custom_key": "custom_value"},
        )

        project_created.send_robust(
            project=self.project,
            user=self.create_user(),
            default_rules=True,
            sender=self.__class__,
        )

        enrollments = DataForwarderProject.objects.filter(
            data_forwarder=data_forwarder, project=self.project
        )
        assert enrollments.count() == 1
        enrollment = enrollments.first()
        assert enrollment is not None
        assert enrollment.overrides == {"custom_key": "custom_value"}

    def test_multiple_data_forwarders_enroll_same_project(self) -> None:
        segment_forwarder = DataForwarder.objects.create(
            organization=self.organization,
            is_enabled=True,
            enroll_new_projects=True,
            provider="segment",
            config={"write_key": "segment_key"},
        )

        sqs_forwarder = DataForwarder.objects.create(
            organization=self.organization,
            is_enabled=True,
            enroll_new_projects=True,
            provider="sqs",
            config={"queue_url": "test_queue"},
        )

        new_project = self.create_project(organization=self.organization, fire_project_created=True)

        segment_enrollment = DataForwarderProject.objects.filter(
            data_forwarder=segment_forwarder, project=new_project
        ).first()
        assert segment_enrollment is not None
        assert segment_enrollment.is_enabled is True

        sqs_enrollment = DataForwarderProject.objects.filter(
            data_forwarder=sqs_forwarder, project=new_project
        ).first()
        assert sqs_enrollment is not None
        assert sqs_enrollment.is_enabled is True

    def test_mixed_data_forwarders_only_enroll_into_some(self) -> None:
        enabled_forwarder = DataForwarder.objects.create(
            organization=self.organization,
            is_enabled=True,
            enroll_new_projects=True,
            provider="segment",
            config={"write_key": "segment_key"},
        )

        disabled_forwarder = DataForwarder.objects.create(
            organization=self.organization,
            is_enabled=False,
            enroll_new_projects=True,
            provider="sqs",
            config={"queue_url": "test_queue"},
        )

        no_auto_enroll_forwarder = DataForwarder.objects.create(
            organization=self.organization,
            is_enabled=True,
            enroll_new_projects=False,
            provider="splunk",
            config={"endpoint": "test_endpoint"},
        )

        new_project = self.create_project(organization=self.organization, fire_project_created=True)

        enabled_enrollment = DataForwarderProject.objects.filter(
            data_forwarder=enabled_forwarder, project=new_project
        ).first()
        assert enabled_enrollment is not None

        disabled_enrollment = DataForwarderProject.objects.filter(
            data_forwarder=disabled_forwarder, project=new_project
        ).first()
        assert disabled_enrollment is None

        no_auto_enroll_enrollment = DataForwarderProject.objects.filter(
            data_forwarder=no_auto_enroll_forwarder, project=new_project
        ).first()
        assert no_auto_enroll_enrollment is None
