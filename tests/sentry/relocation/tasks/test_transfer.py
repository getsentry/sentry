import threading
from datetime import timedelta
from io import BytesIO
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
from django.db import connections
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
    process_relocation_transfer_region,
)
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase, TransactionTestCase
from sentry.testutils.silo import (
    assume_test_silo_mode,
    cell_silo_test,
    control_silo_test,
    create_test_cells,
)

TEST_REGIONS = create_test_cells("us", "de")


def create_control_relocation_transfer(organization: Organization, **kwargs):
    if "relocation_uuid" not in kwargs:
        kwargs["relocation_uuid"] = uuid4()
    if "state" not in kwargs:
        kwargs["state"] = RelocationTransferState.Request

    return ControlRelocationTransfer.objects.create(
        org_slug=organization.slug, requesting_cell="de", exporting_cell="us", **kwargs
    )


def create_cell_relocation_transfer(organization: Organization, **kwargs):
    if "relocation_uuid" not in kwargs:
        kwargs["relocation_uuid"] = uuid4()
    if "state" not in kwargs:
        kwargs["state"] = RelocationTransferState.Request

    return RegionRelocationTransfer.objects.create(
        org_slug=organization.slug, requesting_cell="de", exporting_cell="us", **kwargs
    )


@control_silo_test
class FindRelocationTransferControlTest(TestCase):
    @patch("sentry.relocation.tasks.transfer.process_relocation_transfer_control")
    def test_no_records(self, mock_process: MagicMock) -> None:
        find_relocation_transfer_control()
        assert not mock_process.delay.called

    @patch("sentry.relocation.tasks.transfer.process_relocation_transfer_control")
    def test_no_due_records(self, mock_process: MagicMock) -> None:
        create_control_relocation_transfer(
            organization=self.organization, scheduled_for=timezone.now() + timedelta(minutes=2)
        )
        find_relocation_transfer_control()
        assert not mock_process.delay.called

    @patch("sentry.relocation.tasks.transfer.process_relocation_transfer_control")
    def test_due_records(self, mock_process: MagicMock) -> None:
        transfer = create_control_relocation_transfer(
            organization=self.organization, scheduled_for=timezone.now() - timedelta(minutes=2)
        )
        find_relocation_transfer_control()
        assert mock_process.delay.called
        assert mock_process.delay.call_args[1]["transfer_id"] == transfer.id
        transfer.refresh_from_db()
        assert transfer.scheduled_for > timezone.now()

    @patch("sentry.relocation.tasks.transfer.process_relocation_transfer_control")
    def test_purge_expired(self, mock_process: MagicMock) -> None:
        transfer = create_control_relocation_transfer(
            organization=self.organization,
            scheduled_for=timezone.now() - timedelta(minutes=2),
        )
        transfer.date_added = timezone.now() - timedelta(hours=1, minutes=22)
        transfer.save()
        find_relocation_transfer_control()
        assert not mock_process.delay.called
        assert not ControlRelocationTransfer.objects.filter(id=transfer.id).exists()

    @patch("sentry.relocation.tasks.transfer.process_relocation_transfer_control")
    def test_enqueue_failure_keeps_claim(self, mock_process: MagicMock) -> None:
        transfer = create_control_relocation_transfer(
            organization=self.organization, scheduled_for=timezone.now() - timedelta(minutes=2)
        )
        mock_process.delay.side_effect = RuntimeError("task broker unavailable")

        with pytest.raises(RuntimeError, match="task broker unavailable"):
            find_relocation_transfer_control()

        transfer.refresh_from_db()
        assert transfer.scheduled_for > timezone.now()

        mock_process.delay.reset_mock(side_effect=True)
        find_relocation_transfer_control()
        assert not mock_process.delay.called

        transfer.update(scheduled_for=timezone.now() - timedelta(minutes=2))
        find_relocation_transfer_control()
        mock_process.delay.assert_called_once_with(transfer_id=transfer.id)


@control_silo_test
class FindRelocationTransferControlConcurrencyTest(TransactionTestCase):
    @patch("sentry.relocation.tasks.transfer.process_relocation_transfer_control")
    def test_concurrent_schedulers_publish_once(self, mock_process: MagicMock) -> None:
        transfer = create_control_relocation_transfer(
            organization=self.organization, scheduled_for=timezone.now() - timedelta(minutes=2)
        )
        first_publish_started = threading.Event()
        second_scheduler_finished = threading.Event()

        def delay(**kwargs) -> None:
            if not first_publish_started.is_set():
                first_publish_started.set()
                assert second_scheduler_finished.wait(timeout=5)

        mock_process.delay.side_effect = delay

        def run_first_scheduler() -> None:
            try:
                find_relocation_transfer_control()
            finally:
                connections.close_all()

        def run_second_scheduler() -> None:
            try:
                find_relocation_transfer_control()
            finally:
                second_scheduler_finished.set()
                connections.close_all()

        first_scheduler = threading.Thread(target=run_first_scheduler)
        first_scheduler.start()
        assert first_publish_started.wait(timeout=5)

        second_scheduler = threading.Thread(target=run_second_scheduler)
        second_scheduler.start()
        second_scheduler.join(timeout=5)
        first_scheduler.join(timeout=5)

        assert not first_scheduler.is_alive()
        assert not second_scheduler.is_alive()
        mock_process.delay.assert_called_once_with(transfer_id=transfer.id)


class FindRelocationTransferRegionTest(TestCase):
    @patch("sentry.relocation.tasks.transfer.process_relocation_transfer_region")
    def test_no_records(self, mock_process: MagicMock) -> None:
        find_relocation_transfer_region()
        assert not mock_process.delay.called

    @patch("sentry.relocation.tasks.transfer.process_relocation_transfer_region")
    def test_no_due_records(self, mock_process: MagicMock) -> None:
        create_cell_relocation_transfer(
            organization=self.organization, scheduled_for=timezone.now() + timedelta(minutes=2)
        )
        find_relocation_transfer_region()
        assert not mock_process.delay.called

    @patch("sentry.relocation.tasks.transfer.process_relocation_transfer_region")
    def test_due_records(self, mock_process: MagicMock) -> None:
        transfer = create_cell_relocation_transfer(
            organization=self.organization, scheduled_for=timezone.now() - timedelta(minutes=2)
        )
        find_relocation_transfer_region()
        assert mock_process.delay.called
        transfer.refresh_from_db()
        assert transfer.scheduled_for > timezone.now()

    @patch("sentry.relocation.tasks.transfer.process_relocation_transfer_region")
    def test_purge_expired(self, mock_process: MagicMock) -> None:
        transfer = create_cell_relocation_transfer(
            organization=self.organization,
            scheduled_for=timezone.now() - timedelta(minutes=2),
        )
        transfer.date_added = timezone.now() - timedelta(hours=1, minutes=22)
        transfer.save()

        find_relocation_transfer_region()
        assert not mock_process.delay.called
        assert not RegionRelocationTransfer.objects.filter(id=transfer.id).exists()


@control_silo_test(cells=TEST_REGIONS)
class ProcessRelocationTransferControlTest(TestCase):
    def test_missing_transfer(self) -> None:
        res = process_relocation_transfer_control(transfer_id=999)
        assert res is None

    @patch("sentry.relocation.tasks.process.fulfill_cross_region_export_request")
    def test_transfer_request_state(self, mock_fulfill: MagicMock) -> None:
        transfer = create_control_relocation_transfer(
            organization=self.organization,
            state=RelocationTransferState.Request,
            public_key=b"public_key_data",
        )
        process_relocation_transfer_control(transfer_id=transfer.id)

        assert mock_fulfill.apply_async.called, "task should be spawned"
        # Should be removed on completion.
        assert not ControlRelocationTransfer.objects.filter(id=transfer.id).exists()

    @patch("sentry.relocation.tasks.process.uploading_complete")
    def test_transfer_reply_state(self, mock_uploading_complete: MagicMock) -> None:
        organization = self.organization
        with assume_test_silo_mode(SiloMode.CELL):
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

        assert mock_uploading_complete.apply_async.called, "task should be spawned"
        # Should be removed on completion.
        assert not ControlRelocationTransfer.objects.filter(id=transfer.id).exists()
        # the relocation RPC call should create a file on the cell
        with assume_test_silo_mode(SiloMode.CELL):
            assert RelocationFile.objects.filter(relocation=relocation).exists()


@cell_silo_test(cells=TEST_REGIONS)
class ProcessRelocationTransferRegionTest(TestCase):
    def test_missing_transfer(self) -> None:
        res = process_relocation_transfer_region(transfer_id=999)
        assert res is None

    def test_transfer_request_state(self) -> None:
        transfer = create_cell_relocation_transfer(
            organization=self.organization,
            state=RelocationTransferState.Request,
        )
        process_relocation_transfer_region(transfer_id=transfer.id)
        # Should be removed as something has gone off the rails
        assert not RegionRelocationTransfer.objects.filter(id=transfer.id).exists()

    def test_transfer_reply_state(self) -> None:
        organization = self.organization
        relocation = Relocation.objects.create(
            creator_id=self.user.id,
            owner_id=self.user.id,
            want_org_slugs=["acme-org"],
            step=Relocation.Step.UPLOADING.value,
        )
        transfer = create_cell_relocation_transfer(
            organization=organization,
            relocation_uuid=relocation.uuid,
            state=RelocationTransferState.Reply,
        )
        relocation_storage = get_relocation_storage()
        relocation_storage.save(
            f"runs/{relocation.uuid}/saas_to_saas_export/{organization.slug}.tar",
            BytesIO(b"export data"),
        )

        process_relocation_transfer_region(transfer_id=transfer.id)

        # Should be removed on completion.
        assert not RegionRelocationTransfer.objects.filter(id=transfer.id).exists()

        with assume_test_silo_mode(SiloMode.CONTROL):
            assert ControlRelocationTransfer.objects.filter(
                state=RelocationTransferState.Reply,
                org_slug=organization.slug,
                exporting_cell=transfer.exporting_cell,
                requesting_cell=transfer.requesting_cell,
            ).exists()
