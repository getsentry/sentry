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


class RelocationStartTestCase(RelocationUtilsTestCase):
    def test_bad_relocation_not_found(self):
        uuid = uuid4().hex
        (relocation, attempts_left) = start_relocation_task(
            uuid, Relocation.Step.UPLOADING, OrderedTask.UPLOADING_COMPLETE, 3
        )

        assert relocation is None
        assert not attempts_left

    def test_bad_relocation_completed(self):
        self.relocation.status = Relocation.Status.FAILURE.value
        self.relocation.save()

        (relocation, attempts_left) = start_relocation_task(
            self.uuid, Relocation.Step.UPLOADING, OrderedTask.UPLOADING_COMPLETE, 3
        )

        assert relocation is None
        assert not attempts_left
        assert Relocation.objects.get(uuid=self.uuid).status == Relocation.Status.FAILURE.value

    def test_bad_unknown_task(self):
        (relocation, attempts_left) = start_relocation_task(
            self.uuid, Relocation.Step.UPLOADING, OrderedTask.NONE, 3
        )

        assert relocation is None
        assert not attempts_left
        assert Relocation.objects.get(uuid=self.uuid).status == Relocation.Status.FAILURE.value

    def test_bad_task_out_of_order(self):
        self.relocation.latest_task = OrderedTask.PREPROCESSING_SCAN.name
        self.relocation.save()

        (relocation, attempts_left) = start_relocation_task(
            self.uuid, Relocation.Step.UPLOADING, OrderedTask.UPLOADING_COMPLETE, 3
        )

        assert relocation is None
        assert not attempts_left
        assert Relocation.objects.get(uuid=self.uuid).status == Relocation.Status.FAILURE.value

    def test_good_first_task(self):
        (relocation, attempts_left) = start_relocation_task(
            self.uuid, Relocation.Step.UPLOADING, OrderedTask.UPLOADING_COMPLETE, 3
        )

        assert relocation is not None
        assert attempts_left == 2

        relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation is not None
        assert relocation.step == Relocation.Step.UPLOADING.value
        assert relocation.status != Relocation.Status.FAILURE.value

    def test_good_next_task(self):
        self.relocation.latest_task = OrderedTask.UPLOADING_COMPLETE.name
        self.relocation.save()

        assert self.relocation.step == Relocation.Step.UPLOADING.value

        (relocation, attempts_left) = start_relocation_task(
            self.uuid, Relocation.Step.PREPROCESSING, OrderedTask.PREPROCESSING_SCAN, 3
        )

        assert relocation is not None
        assert attempts_left == 2

        relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation is not None
        assert relocation.step == Relocation.Step.PREPROCESSING.value
        assert relocation.status != Relocation.Status.FAILURE.value


class RelocationFailTestCase(RelocationUtilsTestCase):
    def test_no_reason(self):
        fail_relocation(self.relocation, OrderedTask.UPLOADING_COMPLETE)

        relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.status == Relocation.Status.FAILURE.value
        assert not relocation.failure_reason

    def test_with_reason(self):
        fail_relocation(self.relocation, OrderedTask.UPLOADING_COMPLETE, "foo")

        relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.status == Relocation.Status.FAILURE.value
        assert relocation.failure_reason == "foo"


class RelocationRetryOrFailTestCase(RelocationUtilsTestCase):
    def test_no_reason_attempts_left(self):
        with pytest.raises(ValueError):
            with retry_task_or_fail_relocation(self.relocation, OrderedTask.UPLOADING_COMPLETE, 3):
                raise ValueError("Some sort of failure")

        assert Relocation.objects.get(uuid=self.uuid).status == Relocation.Status.IN_PROGRESS.value

    def test_no_reason_last_attempt(self):
        # Wrap in `try/except` to make mypy happy.
        try:
            with retry_task_or_fail_relocation(self.relocation, OrderedTask.UPLOADING_COMPLETE, 0):
                raise ValueError("Some sort of failure")
        except Exception:
            pass

        assert Relocation.objects.get(uuid=self.uuid).status == Relocation.Status.FAILURE.value

    def test_with_reason_attempts_left(self):
        with pytest.raises(ValueError):
            with retry_task_or_fail_relocation(
                self.relocation, OrderedTask.UPLOADING_COMPLETE, 3, "foo"
            ):
                raise ValueError("Some sort of failure")

        relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation is not None
        assert relocation.status == Relocation.Status.IN_PROGRESS.value
        assert not relocation.failure_reason

    def test_with_reason_last_attempt(self):
        # Wrap in `try/except` to make mypy happy.
        try:
            with retry_task_or_fail_relocation(
                self.relocation, OrderedTask.UPLOADING_COMPLETE, 0, "foo"
            ):
                raise ValueError("Some sort of failure")
        except Exception:
            pass

        relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation is not None
        assert relocation.status == Relocation.Status.FAILURE.value
        assert relocation.failure_reason == "foo"
