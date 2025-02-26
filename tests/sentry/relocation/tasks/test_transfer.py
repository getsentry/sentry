from datetime import timedelta
from io import BytesIO
from unittest.mock import patch
from uuid import uuid4

from django.utils import timezone

from sentry.models.files.utils import get_relocation_storage
from sentry.models.organization import Organization
from sentry.relocation.models.relocation import Relocation, RelocationFile
from sentry.relocation.models.relocationtransfer import (
    ControlRelocationTransfer,
    RegionRelocationTransfer,
    RelocationTransferState,
)
from sentry.relocation.tasks.transfer import (
    find_relocation_transfer_control,
    find_relocation_transfer_region,
    process_relocation_transfer_control,
)
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test, create_test_regions

TEST_REGIONS = create_test_regions("us", "de")


def create_control_relocation_transfer(organization: Organization, **kwargs):
    if "relocation_uuid" not in kwargs:
        kwargs["relocation_uuid"] = uuid4()
    if "state" not in kwargs:
        kwargs["state"] = RelocationTransferState.Request

    return ControlRelocationTransfer.objects.create(
        org_slug=organization.slug, requesting_region="de", exporting_region="us", **kwargs
    )


def create_region_relocation_transfer(organization: Organization, **kwargs):
    if "relocation_uuid" not in kwargs:
        kwargs["relocation_uuid"] = uuid4()
    if "state" not in kwargs:
        kwargs["state"] = RelocationTransferState.Request

    return RegionRelocationTransfer.objects.create(
        org_slug=organization.slug, requesting_region="de", exporting_region="us", **kwargs
    )


@control_silo_test
class FindRelocationTransferControlTest(TestCase):
    @patch("sentry.relocation.tasks.transfer.process_relocation_transfer_control")
    def test_no_records(self, mock_process):
        find_relocation_transfer_control()
        assert not mock_process.delay.called

    @patch("sentry.relocation.tasks.transfer.process_relocation_transfer_control")
    def test_no_due_records(self, mock_process):
        create_control_relocation_transfer(
            organization=self.organization, scheduled_for=timezone.now() + timedelta(minutes=2)
        )
        find_relocation_transfer_control()
        assert not mock_process.delay.called

    @patch("sentry.relocation.tasks.transfer.process_relocation_transfer_control")
    def test_due_records(self, mock_process):
        transfer = create_control_relocation_transfer(
            organization=self.organization, scheduled_for=timezone.now() - timedelta(minutes=2)
        )
        find_relocation_transfer_control()
        assert mock_process.delay.called
        transfer.refresh_from_db()
        assert transfer.scheduled_for > timezone.now()

    @patch("sentry.relocation.tasks.transfer.process_relocation_transfer_control")
    def test_purge_expired(self, mock_process):
        transfer = create_control_relocation_transfer(
            organization=self.organization,
            scheduled_for=timezone.now() - timedelta(minutes=2),
        )
        transfer.date_added = timezone.now() - timedelta(hours=1, minutes=2)
        transfer.save()
        find_relocation_transfer_control()
        assert not mock_process.delay.called
        assert not ControlRelocationTransfer.objects.filter(id=transfer.id).exists()


class FindRelocationTransferRegionTest(TestCase):
    @patch("sentry.relocation.tasks.transfer.process_relocation_transfer_region")
    def test_no_records(self, mock_process):
        find_relocation_transfer_region()
        assert not mock_process.delay.called

    @patch("sentry.relocation.tasks.transfer.process_relocation_transfer_region")
    def test_no_due_records(self, mock_process):
        create_region_relocation_transfer(
            organization=self.organization, scheduled_for=timezone.now() + timedelta(minutes=2)
        )
        find_relocation_transfer_region()
        assert not mock_process.delay.called

    @patch("sentry.relocation.tasks.transfer.process_relocation_transfer_region")
    def test_due_records(self, mock_process):
        transfer = create_region_relocation_transfer(
            organization=self.organization, scheduled_for=timezone.now() - timedelta(minutes=2)
        )
        find_relocation_transfer_region()
        assert mock_process.delay.called
        transfer.refresh_from_db()
        assert transfer.scheduled_for > timezone.now()

    @patch("sentry.relocation.tasks.transfer.process_relocation_transfer_region")
    def test_purge_expired(self, mock_process):
        transfer = create_region_relocation_transfer(
            organization=self.organization,
            scheduled_for=timezone.now() - timedelta(minutes=2),
        )
        transfer.date_added = timezone.now() - timedelta(hours=1, minutes=2)
        transfer.save()

        find_relocation_transfer_region()
        assert not mock_process.delay.called
        assert not RegionRelocationTransfer.objects.filter(id=transfer.id).exists()


@control_silo_test(regions=TEST_REGIONS)
class ProcessRelocationTransferControlTest(TestCase):
    def test_missing_transfer(self):
        res = process_relocation_transfer_control(transfer_id=999)
        assert res is None

    @patch("sentry.relocation.services.relocation_export.impl.fulfill_cross_region_export_request")
    def test_transfer_request_state(self, mock_fulfill):
        transfer = create_control_relocation_transfer(
            organization=self.organization,
            state=RelocationTransferState.Request,
            public_key=b"public_key_data",
        )
        process_relocation_transfer_control(transfer_id=transfer.id)

        assert mock_fulfill.apply_async.called, "celery task should be spawned"
        # Should be removed on completion.
        assert not ControlRelocationTransfer.objects.filter(id=transfer.id).exists()

    @patch("sentry.relocation.services.relocation_export.impl.uploading_complete")
    def test_transfer_reply_state(self, mock_uploading_complete):
        organization = self.organization
        with assume_test_silo_mode(SiloMode.REGION):
            relocation = Relocation.objects.create(
                creator_id=self.user.id,
                owner_id=self.user.id,
                want_org_slugs=["acme-org"],
                step=Relocation.Step.UPLOADING.value,
            )
        transfer = create_control_relocation_transfer(
            organization=organization,
            relocation_uuid=relocation.uuid,
            state=RelocationTransferState.Reply,
            public_key=b"public_key_data",
        )
        relocation_storage = get_relocation_storage()
        relocation_storage.save(
            f"runs/{relocation.uuid}/saas_to_saas_export/{organization.slug}.tar",
            BytesIO(b"export data"),
        )

        process_relocation_transfer_control(transfer_id=transfer.id)

        assert mock_uploading_complete.apply_async.called, "celery task should be spawned"
        # Should be removed on completion.
        assert not ControlRelocationTransfer.objects.filter(id=transfer.id).exists()
        # the relocation RPC call should create a file on the region
        with assume_test_silo_mode(SiloMode.REGION):
            assert RelocationFile.objects.filter(relocation=relocation).exists()
