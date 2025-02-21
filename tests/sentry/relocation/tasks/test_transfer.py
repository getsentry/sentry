from datetime import timedelta
from unittest.mock import patch
from uuid import uuid4

from django.utils import timezone

from sentry.relocation.models.relocationtransfer import (
    ControlRelocationTransfer,
    RegionRelocationTransfer,
    RelocationTransferState,
)
from sentry.relocation.tasks.transfer import (
    find_relocation_transfer_control,
    find_relocation_transfer_region,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class FindRelocationTransferControlTest(TestCase):
    def create_control_relocation_transfer(self, **kwargs):
        if "relocation_uuid" not in kwargs:
            kwargs["relocation_uuid"] = uuid4()
        if "state" not in kwargs:
            kwargs["state"] = RelocationTransferState.Request

        return ControlRelocationTransfer.objects.create(
            org_slug=self.organization.slug, requesting_region="de", exporting_region="us", **kwargs
        )

    @patch("sentry.relocation.tasks.transfer.process_relocation_transfer_control")
    def test_no_records(self, mock_process):
        find_relocation_transfer_control()
        assert not mock_process.delay.called

    @patch("sentry.relocation.tasks.transfer.process_relocation_transfer_control")
    def test_no_due_records(self, mock_process):
        self.create_control_relocation_transfer(scheduled_for=timezone.now() + timedelta(minutes=2))
        find_relocation_transfer_control()
        assert not mock_process.delay.called

    @patch("sentry.relocation.tasks.transfer.process_relocation_transfer_control")
    def test_due_records(self, mock_process):
        transfer = self.create_control_relocation_transfer(
            scheduled_for=timezone.now() - timedelta(minutes=2)
        )
        find_relocation_transfer_control()
        assert mock_process.delay.called
        transfer.refresh_from_db()
        assert transfer.scheduled_for > timezone.now()

    @patch("sentry.relocation.tasks.transfer.process_relocation_transfer_control")
    def test_purge_expired(self, mock_process):
        transfer = self.create_control_relocation_transfer(
            scheduled_for=timezone.now() - timedelta(minutes=2),
        )
        transfer.date_added = timezone.now() - timedelta(hours=1, minutes=2)
        transfer.save()
        find_relocation_transfer_control()
        assert not mock_process.delay.called
        assert not ControlRelocationTransfer.objects.filter(id=transfer.id).exists()


class FindRelocationTransferRegionTest(TestCase):
    def create_region_relocation_transfer(self, **kwargs):
        if "relocation_uuid" not in kwargs:
            kwargs["relocation_uuid"] = uuid4()
        if "state" not in kwargs:
            kwargs["state"] = RelocationTransferState.Request

        return RegionRelocationTransfer.objects.create(
            org_slug=self.organization.slug, requesting_region="de", exporting_region="us", **kwargs
        )

    @patch("sentry.relocation.tasks.transfer.process_relocation_transfer_region")
    def test_no_records(self, mock_process):
        find_relocation_transfer_region()
        assert not mock_process.delay.called

    @patch("sentry.relocation.tasks.transfer.process_relocation_transfer_region")
    def test_no_due_records(self, mock_process):
        self.create_region_relocation_transfer(scheduled_for=timezone.now() + timedelta(minutes=2))
        find_relocation_transfer_region()
        assert not mock_process.delay.called

    @patch("sentry.relocation.tasks.transfer.process_relocation_transfer_region")
    def test_due_records(self, mock_process):
        transfer = self.create_region_relocation_transfer(
            scheduled_for=timezone.now() - timedelta(minutes=2)
        )
        find_relocation_transfer_region()
        assert mock_process.delay.called
        transfer.refresh_from_db()
        assert transfer.scheduled_for > timezone.now()

    @patch("sentry.relocation.tasks.transfer.process_relocation_transfer_region")
    def test_purge_expired(self, mock_process):
        transfer = self.create_region_relocation_transfer(
            scheduled_for=timezone.now() - timedelta(minutes=2),
        )
        transfer.date_added = timezone.now() - timedelta(hours=1, minutes=2)
        transfer.save()

        find_relocation_transfer_region()
        assert not mock_process.delay.called
        assert not RegionRelocationTransfer.objects.filter(id=transfer.id).exists()
