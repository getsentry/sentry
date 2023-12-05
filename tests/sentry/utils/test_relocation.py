from unittest.mock import MagicMock, Mock, patch
from uuid import uuid4

import pytest

from sentry.models.relocation import Relocation
from sentry.testutils.cases import TestCase
from sentry.utils.relocation import (
    OrderedTask,
    fail_relocation,
    retry_task_or_fail_relocation,
    start_relocation_task,
)


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

        uuid = uuid4().hex
        (relocation, attempts_left) = start_relocation_task(
            uuid, Relocation.Step.UPLOADING, OrderedTask.UPLOADING_COMPLETE, 3
        )

        assert fake_message_builder.call_count == 0

        assert relocation is None
        assert not attempts_left

    def test_bad_relocation_completed(self, fake_message_builder: Mock):
        self.mock_message_builder(fake_message_builder)

        self.relocation.status = Relocation.Status.FAILURE.value
        self.relocation.save()

        (relocation, attempts_left) = start_relocation_task(
            self.uuid, Relocation.Step.UPLOADING, OrderedTask.UPLOADING_COMPLETE, 3
        )

        assert fake_message_builder.call_count == 0

        assert relocation is None
        assert not attempts_left
        assert Relocation.objects.get(uuid=self.uuid).status == Relocation.Status.FAILURE.value

    def test_bad_unknown_task(self, fake_message_builder: Mock):
        self.mock_message_builder(fake_message_builder)

        (relocation, attempts_left) = start_relocation_task(
            self.uuid, Relocation.Step.UPLOADING, OrderedTask.NONE, 3
        )

        assert fake_message_builder.call_count == 1
        assert fake_message_builder.call_args.kwargs["type"] == "relocation.failed"
        fake_message_builder.return_value.send_async.assert_called_once_with(
            to=[self.owner.email, self.superuser.email]
        )

        assert relocation is None
        assert not attempts_left
        assert Relocation.objects.get(uuid=self.uuid).status == Relocation.Status.FAILURE.value

    def test_bad_task_out_of_order(self, fake_message_builder: Mock):
        self.mock_message_builder(fake_message_builder)

        self.relocation.latest_task = OrderedTask.PREPROCESSING_SCAN.name
        self.relocation.save()

        (relocation, attempts_left) = start_relocation_task(
            self.uuid, Relocation.Step.UPLOADING, OrderedTask.UPLOADING_COMPLETE, 3
        )

        assert fake_message_builder.call_count == 1
        assert fake_message_builder.call_args.kwargs["type"] == "relocation.failed"
        fake_message_builder.return_value.send_async.assert_called_once_with(
            to=[self.owner.email, self.superuser.email]
        )

        assert relocation is None
        assert not attempts_left
        assert Relocation.objects.get(uuid=self.uuid).status == Relocation.Status.FAILURE.value

    def test_good_first_task(self, fake_message_builder: Mock):
        self.mock_message_builder(fake_message_builder)

        (relocation, attempts_left) = start_relocation_task(
            self.uuid, Relocation.Step.UPLOADING, OrderedTask.UPLOADING_COMPLETE, 3
        )

        assert fake_message_builder.call_count == 0

        assert relocation is not None
        assert attempts_left == 2

        relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation is not None
        assert relocation.step == Relocation.Step.UPLOADING.value
        assert relocation.status != Relocation.Status.FAILURE.value

    def test_good_next_task(self, fake_message_builder: Mock):
        self.mock_message_builder(fake_message_builder)

        self.relocation.latest_task = OrderedTask.UPLOADING_COMPLETE.name
        self.relocation.save()

        assert self.relocation.step == Relocation.Step.UPLOADING.value

        (relocation, attempts_left) = start_relocation_task(
            self.uuid, Relocation.Step.PREPROCESSING, OrderedTask.PREPROCESSING_SCAN, 3
        )

        assert fake_message_builder.call_count == 0

        assert relocation is not None
        assert attempts_left == 2

        relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation is not None
        assert relocation.step == Relocation.Step.PREPROCESSING.value
        assert relocation.status != Relocation.Status.FAILURE.value


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

        relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.status == Relocation.Status.FAILURE.value
        assert not relocation.failure_reason

    def test_with_reason(self, fake_message_builder: Mock):
        self.mock_message_builder(fake_message_builder)

        fail_relocation(self.relocation, OrderedTask.UPLOADING_COMPLETE, "foo")

        assert fake_message_builder.call_count == 1
        assert fake_message_builder.call_args.kwargs["type"] == "relocation.failed"
        fake_message_builder.return_value.send_async.assert_called_once_with(
            to=[self.owner.email, self.superuser.email]
        )

        relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.status == Relocation.Status.FAILURE.value
        assert relocation.failure_reason == "foo"


@patch("sentry.utils.relocation.MessageBuilder")
class RelocationRetryOrFailTestCase(RelocationUtilsTestCase):
    def test_no_reason_attempts_left(self, fake_message_builder: Mock):
        self.mock_message_builder(fake_message_builder)

        with pytest.raises(ValueError):
            with retry_task_or_fail_relocation(self.relocation, OrderedTask.UPLOADING_COMPLETE, 3):
                raise ValueError("Some sort of failure")

        assert fake_message_builder.call_count == 0

        assert Relocation.objects.get(uuid=self.uuid).status == Relocation.Status.IN_PROGRESS.value

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

        assert Relocation.objects.get(uuid=self.uuid).status == Relocation.Status.FAILURE.value

    def test_with_reason_attempts_left(self, fake_message_builder: Mock):
        self.mock_message_builder(fake_message_builder)

        with pytest.raises(ValueError):
            with retry_task_or_fail_relocation(
                self.relocation, OrderedTask.UPLOADING_COMPLETE, 3, "foo"
            ):
                raise ValueError("Some sort of failure")

        assert fake_message_builder.call_count == 0

        relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation is not None
        assert relocation.status == Relocation.Status.IN_PROGRESS.value
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

        relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation is not None
        assert relocation.status == Relocation.Status.FAILURE.value
        assert relocation.failure_reason == "foo"
