from unittest.mock import MagicMock, Mock, patch
from uuid import uuid4

import pytest

from sentry.relocation.models.relocation import Relocation
from sentry.relocation.utils import (
    OrderedTask,
    fail_relocation,
    retry_task_or_fail_relocation,
    start_relocation_task,
)
from sentry.testutils.cases import TestCase


class RelocationUtilsTestCase(TestCase):
    def setUp(self):
        super().setUp()
        self.owner = self.create_user(
            email="owner", is_superuser=False, is_staff=False, is_active=True
        )
        self.superuser = self.create_user(
            "superuser", is_superuser=True, is_staff=True, is_active=True
        )
        self.relocation: Relocation = Relocation.objects.create(
            creator_id=self.superuser.id,
            owner_id=self.owner.id,
            want_org_slugs=["testing"],
            step=Relocation.Step.UPLOADING.value,
        )
        self.uuid = self.relocation.uuid

    def mock_message_builder(self, fake_message_builder: Mock):
        fake_message_builder.return_value.send_async.return_value = MagicMock()


@patch("sentry.utils.relocation.MessageBuilder")
class RelocationStartTestCase(RelocationUtilsTestCase):
    def test_bad_relocation_not_found(self, fake_message_builder: Mock):
        self.mock_message_builder(fake_message_builder)

        uuid = uuid4()
        (rel, attempts_left) = start_relocation_task(uuid, OrderedTask.UPLOADING_COMPLETE, 3)

        assert fake_message_builder.call_count == 0

        assert rel is None
        assert not attempts_left

    def test_bad_relocation_completed(self, fake_message_builder: Mock):
        self.mock_message_builder(fake_message_builder)

        self.relocation.status = Relocation.Status.FAILURE.value
        self.relocation.save()

        (rel, attempts_left) = start_relocation_task(self.uuid, OrderedTask.UPLOADING_COMPLETE, 3)

        assert fake_message_builder.call_count == 0

        assert rel is None
        assert not attempts_left
        assert Relocation.objects.get(uuid=self.uuid).status == Relocation.Status.FAILURE.value

    def test_bad_unknown_task(self, fake_message_builder: Mock):
        self.mock_message_builder(fake_message_builder)

        (rel, attempts_left) = start_relocation_task(self.uuid, OrderedTask.NONE, 3)

        assert fake_message_builder.call_count == 1
        assert fake_message_builder.call_args.kwargs["type"] == "relocation.failed"
        fake_message_builder.return_value.send_async.assert_called_once_with(
            to=[self.owner.email, self.superuser.email]
        )

        assert rel is None
        assert not attempts_left
        assert Relocation.objects.get(uuid=self.uuid).status == Relocation.Status.FAILURE.value

    def test_bad_task_out_of_order(self, fake_message_builder: Mock):
        self.mock_message_builder(fake_message_builder)

        self.relocation.latest_task = OrderedTask.PREPROCESSING_SCAN.name
        self.relocation.save()

        (rel, attempts_left) = start_relocation_task(self.uuid, OrderedTask.UPLOADING_COMPLETE, 3)

        assert fake_message_builder.call_count == 1
        assert fake_message_builder.call_args.kwargs["type"] == "relocation.failed"
        fake_message_builder.return_value.send_async.assert_called_once_with(
            to=[self.owner.email, self.superuser.email]
        )

        assert rel is None
        assert not attempts_left
        assert Relocation.objects.get(uuid=self.uuid).status == Relocation.Status.FAILURE.value

    def test_bad_task_attempts_exhausted(self, fake_message_builder: Mock):
        self.mock_message_builder(fake_message_builder)

        self.relocation.latest_task = OrderedTask.IMPORTING.name
        self.relocation.latest_task_attempts = 3
        self.relocation.save()

        (rel, attempts_left) = start_relocation_task(self.uuid, OrderedTask.IMPORTING, 3)

        assert fake_message_builder.call_count == 1
        assert fake_message_builder.call_args.kwargs["type"] == "relocation.failed"
        fake_message_builder.return_value.send_async.assert_called_once_with(
            to=[self.owner.email, self.superuser.email]
        )

        assert rel is None
        assert not attempts_left
        assert Relocation.objects.get(uuid=self.uuid).status == Relocation.Status.FAILURE.value

    def test_good_first_task(self, fake_message_builder: Mock):
        self.mock_message_builder(fake_message_builder)

        (rel, attempts_left) = start_relocation_task(self.uuid, OrderedTask.UPLOADING_START, 3)

        assert fake_message_builder.call_count == 0
        assert attempts_left == 2

        relocation: Relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.step == Relocation.Step.UPLOADING.value
        assert relocation.status != Relocation.Status.FAILURE.value

    def test_good_next_task(self, fake_message_builder: Mock):
        self.mock_message_builder(fake_message_builder)

        self.relocation.latest_task = OrderedTask.UPLOADING_COMPLETE.name
        self.relocation.save()

        (rel, attempts_left) = start_relocation_task(self.uuid, OrderedTask.PREPROCESSING_SCAN, 3)

        assert fake_message_builder.call_count == 0
        assert attempts_left == 2

        relocation: Relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.step == Relocation.Step.PREPROCESSING.value
        assert relocation.status != Relocation.Status.FAILURE.value

    def test_good_pause_at_scheduled_pause(self, fake_message_builder: Mock):
        self.mock_message_builder(fake_message_builder)

        self.relocation.latest_task = OrderedTask.UPLOADING_COMPLETE.name
        self.relocation.scheduled_pause_at_step = Relocation.Step.PREPROCESSING.value
        self.relocation.save()

        (rel, attempts_left) = start_relocation_task(self.uuid, OrderedTask.PREPROCESSING_SCAN, 3)

        assert fake_message_builder.call_count == 0
        assert attempts_left == 0

        relocation: Relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.step == Relocation.Step.PREPROCESSING.value
        assert relocation.latest_task == OrderedTask.PREPROCESSING_SCAN.name
        assert relocation.status == Relocation.Status.PAUSE.value
        assert relocation.scheduled_pause_at_step is None

    def test_good_already_paused(self, fake_message_builder: Mock):
        self.mock_message_builder(fake_message_builder)

        self.relocation.latest_task = OrderedTask.UPLOADING_COMPLETE.name
        self.relocation.status = Relocation.Status.PAUSE.value
        self.relocation.save()

        (rel, attempts_left) = start_relocation_task(self.uuid, OrderedTask.UPLOADING_COMPLETE, 3)

        assert fake_message_builder.call_count == 0
        assert attempts_left == 0

        relocation: Relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.step == Relocation.Step.UPLOADING.value
        assert relocation.latest_task == OrderedTask.UPLOADING_COMPLETE.name
        assert relocation.status == Relocation.Status.PAUSE.value
        assert relocation.scheduled_pause_at_step is None

    def test_good_cancel_at_scheduled_cancel(self, fake_message_builder: Mock):
        self.mock_message_builder(fake_message_builder)

        self.relocation.latest_task = OrderedTask.UPLOADING_COMPLETE.name
        self.relocation.scheduled_cancel_at_step = Relocation.Step.PREPROCESSING.value
        self.relocation.save()

        (_, attempts_left) = start_relocation_task(self.uuid, OrderedTask.PREPROCESSING_SCAN, 3)

        assert fake_message_builder.call_count == 0
        assert attempts_left == 0

        relocation: Relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.step == Relocation.Step.PREPROCESSING.value
        assert relocation.latest_task == OrderedTask.PREPROCESSING_SCAN.name
        assert relocation.status == Relocation.Status.FAILURE.value
        assert relocation.scheduled_cancel_at_step is None
        assert relocation.failure_reason == "This relocation was cancelled by an administrator."

    def test_good_already_cancelled(self, fake_message_builder: Mock):
        self.mock_message_builder(fake_message_builder)

        self.relocation.step = Relocation.Step.POSTPROCESSING.value
        self.relocation.latest_task = OrderedTask.POSTPROCESSING.name
        self.relocation.status = Relocation.Status.FAILURE.value
        self.relocation.failure_reason = "Cancelled"
        self.relocation.save()

        (_, attempts_left) = start_relocation_task(self.uuid, OrderedTask.POSTPROCESSING, 3)

        assert fake_message_builder.call_count == 0
        assert attempts_left == 0

        relocation: Relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.step == Relocation.Step.POSTPROCESSING.value
        assert relocation.latest_task == OrderedTask.POSTPROCESSING.name
        assert relocation.status == Relocation.Status.FAILURE.value
        assert relocation.scheduled_cancel_at_step is None
        assert self.relocation.failure_reason == "Cancelled"

    def test_good_cancel_before_pause(self, fake_message_builder: Mock):
        self.mock_message_builder(fake_message_builder)

        self.relocation.latest_task = OrderedTask.UPLOADING_COMPLETE.name
        self.relocation.scheduled_cancel_at_step = Relocation.Step.PREPROCESSING.value
        self.relocation.scheduled_pause_at_step = Relocation.Step.PREPROCESSING.value
        self.relocation.save()

        (_, attempts_left) = start_relocation_task(self.uuid, OrderedTask.PREPROCESSING_SCAN, 3)

        assert fake_message_builder.call_count == 0
        assert attempts_left == 0

        relocation: Relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.step == Relocation.Step.PREPROCESSING.value
        assert relocation.latest_task == OrderedTask.PREPROCESSING_SCAN.name
        assert relocation.status == Relocation.Status.FAILURE.value
        assert relocation.scheduled_pause_at_step is None
        assert relocation.scheduled_cancel_at_step is None
        assert relocation.failure_reason == "This relocation was cancelled by an administrator."

    def test_good_pause_before_cancel(self, fake_message_builder: Mock):
        self.mock_message_builder(fake_message_builder)

        self.relocation.latest_task = OrderedTask.UPLOADING_COMPLETE.name
        self.relocation.scheduled_cancel_at_step = Relocation.Step.POSTPROCESSING.value
        self.relocation.scheduled_pause_at_step = Relocation.Step.PREPROCESSING.value
        self.relocation.save()

        (_, attempts_left) = start_relocation_task(self.uuid, OrderedTask.PREPROCESSING_SCAN, 3)

        assert fake_message_builder.call_count == 0
        assert attempts_left == 0

        relocation: Relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.step == Relocation.Step.PREPROCESSING.value
        assert relocation.latest_task == OrderedTask.PREPROCESSING_SCAN.name
        assert relocation.status == Relocation.Status.PAUSE.value
        assert relocation.scheduled_pause_at_step is None
        assert relocation.scheduled_cancel_at_step == Relocation.Step.POSTPROCESSING.value
        assert relocation.failure_reason is None


@patch("sentry.utils.relocation.MessageBuilder")
class RelocationFailTestCase(RelocationUtilsTestCase):
    def test_no_reason(self, fake_message_builder: Mock):
        self.mock_message_builder(fake_message_builder)

        fail_relocation(self.relocation, OrderedTask.UPLOADING_COMPLETE)

        assert fake_message_builder.call_count == 1
        assert fake_message_builder.call_args.kwargs["type"] == "relocation.failed"
        fake_message_builder.return_value.send_async.assert_called_once_with(
            to=[self.owner.email, self.superuser.email]
        )

        relocation: Relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.status == Relocation.Status.FAILURE.value
        assert relocation.latest_notified == Relocation.EmailKind.FAILED.value
        assert not relocation.failure_reason

    def test_with_reason(self, fake_message_builder: Mock):
        self.mock_message_builder(fake_message_builder)

        fail_relocation(self.relocation, OrderedTask.UPLOADING_COMPLETE, "foo")

        assert fake_message_builder.call_count == 1
        assert fake_message_builder.call_args.kwargs["type"] == "relocation.failed"
        fake_message_builder.return_value.send_async.assert_called_once_with(
            to=[self.owner.email, self.superuser.email]
        )

        relocation: Relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.status == Relocation.Status.FAILURE.value
        assert relocation.latest_notified == Relocation.EmailKind.FAILED.value
        assert relocation.failure_reason == "foo"


@patch("sentry.utils.relocation.MessageBuilder")
class RelocationRetryOrFailTestCase(RelocationUtilsTestCase):
    def test_no_reason_attempts_left(self, fake_message_builder: Mock):
        self.mock_message_builder(fake_message_builder)

        with pytest.raises(ValueError):
            with retry_task_or_fail_relocation(self.relocation, OrderedTask.UPLOADING_COMPLETE, 3):
                raise ValueError("Some sort of failure")

        assert fake_message_builder.call_count == 0

        relocation: Relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.status == Relocation.Status.IN_PROGRESS.value
        assert relocation.latest_notified != Relocation.EmailKind.FAILED.value
        assert not relocation.failure_reason

    def test_no_reason_last_attempt(self, fake_message_builder: Mock):
        self.mock_message_builder(fake_message_builder)

        # Wrap in `try/except` to make mypy happy.
        try:
            with retry_task_or_fail_relocation(self.relocation, OrderedTask.UPLOADING_COMPLETE, 0):
                raise ValueError("Some sort of failure")
        except Exception:
            pass

        assert fake_message_builder.call_count == 1
        assert fake_message_builder.call_args.kwargs["type"] == "relocation.failed"
        fake_message_builder.return_value.send_async.assert_called_once_with(
            to=[self.owner.email, self.superuser.email]
        )

        relocation: Relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.status == Relocation.Status.FAILURE.value
        assert relocation.latest_notified == Relocation.EmailKind.FAILED.value

    def test_with_reason_attempts_left(self, fake_message_builder: Mock):
        self.mock_message_builder(fake_message_builder)

        with pytest.raises(ValueError):
            with retry_task_or_fail_relocation(
                self.relocation, OrderedTask.UPLOADING_COMPLETE, 3, "foo"
            ):
                raise ValueError("Some sort of failure")

        assert fake_message_builder.call_count == 0

        relocation: Relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.status == Relocation.Status.IN_PROGRESS.value
        assert relocation.latest_notified != Relocation.EmailKind.FAILED.value
        assert not relocation.failure_reason

    def test_with_reason_last_attempt(self, fake_message_builder: Mock):
        self.mock_message_builder(fake_message_builder)

        # Wrap in `try/except` to make mypy happy.
        try:
            with retry_task_or_fail_relocation(
                self.relocation, OrderedTask.UPLOADING_COMPLETE, 0, "foo"
            ):
                raise ValueError("Some sort of failure")
        except Exception:
            pass

        assert fake_message_builder.call_count == 1
        assert fake_message_builder.call_args.kwargs["type"] == "relocation.failed"
        fake_message_builder.return_value.send_async.assert_called_once_with(
            to=[self.owner.email, self.superuser.email]
        )

        relocation: Relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.status == Relocation.Status.FAILURE.value
        assert relocation.latest_notified == Relocation.EmailKind.FAILED.value
        assert relocation.failure_reason == "foo"
