from datetime import datetime, timezone
from uuid import uuid4

from sentry.relocation.api.endpoints import ERR_UNKNOWN_RELOCATION_STEP
from sentry.relocation.api.endpoints.cancel import (
    ERR_COULD_NOT_CANCEL_RELOCATION,
    ERR_COULD_NOT_CANCEL_RELOCATION_AT_STEP,
    ERR_NOT_CANCELLABLE_STATUS,
)
from sentry.relocation.models.relocation import Relocation
from sentry.relocation.utils import OrderedTask
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.options import override_options

TEST_DATE_ADDED = datetime(2023, 1, 23, 1, 23, 45, tzinfo=timezone.utc)


class CancelRelocationTest(APITestCase):
    endpoint = "sentry-api-0-relocations-cancel"
    method = "put"

    def setUp(self):
        super().setUp()
        self.owner = self.create_user(
            email="owner", is_superuser=False, is_staff=True, is_active=True
        )
        self.superuser = self.create_user(is_superuser=True)
        self.relocation: Relocation = Relocation.objects.create(
            date_added=TEST_DATE_ADDED,
            creator_id=self.superuser.id,
            owner_id=self.owner.id,
            status=Relocation.Status.IN_PROGRESS.value,
            step=Relocation.Step.PREPROCESSING.value,
            provenance=Relocation.Provenance.SELF_HOSTED.value,
            want_org_slugs=["foo"],
            want_usernames=["alice", "bob"],
            latest_notified=Relocation.EmailKind.STARTED.value,
            latest_task=OrderedTask.PREPROCESSING_SCAN.name,
            latest_task_attempts=1,
        )

    @override_options({"staff.ga-rollout": True})
    def test_good_staff_cancel_in_progress_at_next_step(self):
        staff_user = self.create_user(is_staff=True)
        self.login_as(user=staff_user, staff=True)
        response = self.get_success_response(self.relocation.uuid, status_code=200)

        assert response.data["status"] == Relocation.Status.IN_PROGRESS.name
        assert response.data["step"] == Relocation.Step.PREPROCESSING.name
        assert response.data["scheduledCancelAtStep"] == Relocation.Step.VALIDATING.name

    def test_good_cancel_in_progress_at_next_step(self):
        self.login_as(user=self.superuser, superuser=True)
        response = self.get_success_response(self.relocation.uuid, status_code=200)

        assert response.data["status"] == Relocation.Status.IN_PROGRESS.name
        assert response.data["step"] == Relocation.Step.PREPROCESSING.name
        assert response.data["scheduledCancelAtStep"] == Relocation.Step.VALIDATING.name

    def test_good_cancel_paused_at_next_step(self):
        self.login_as(user=self.superuser, superuser=True)
        self.relocation.status = Relocation.Status.PAUSE.value
        self.relocation.save()
        response = self.get_success_response(self.relocation.uuid, status_code=200)

        assert response.data["status"] == Relocation.Status.PAUSE.name
        assert response.data["step"] == Relocation.Step.PREPROCESSING.name
        assert response.data["scheduledCancelAtStep"] == Relocation.Step.VALIDATING.name

    def test_good_cancel_in_progress_at_specified_step(self):
        self.login_as(user=self.superuser, superuser=True)
        response = self.get_success_response(
            self.relocation.uuid, atStep=Relocation.Step.IMPORTING.name, status_code=200
        )

        assert response.data["status"] == Relocation.Status.IN_PROGRESS.name
        assert response.data["step"] == Relocation.Step.PREPROCESSING.name
        assert response.data["scheduledCancelAtStep"] == Relocation.Step.IMPORTING.name

    def test_good_cancel_paused_at_specified_step(self):
        self.login_as(user=self.superuser, superuser=True)
        self.relocation.status = Relocation.Status.PAUSE.value
        self.relocation.save()
        response = self.get_success_response(
            self.relocation.uuid, atStep=Relocation.Step.IMPORTING.name, status_code=200
        )

        assert response.data["status"] == Relocation.Status.PAUSE.name
        assert response.data["step"] == Relocation.Step.PREPROCESSING.name
        assert response.data["scheduledCancelAtStep"] == Relocation.Step.IMPORTING.name

    def test_good_cancel_at_future_step(self):
        self.login_as(user=self.superuser, superuser=True)
        response = self.get_success_response(
            self.relocation.uuid, atStep=Relocation.Step.NOTIFYING.name, status_code=200
        )

        assert response.data["status"] == Relocation.Status.IN_PROGRESS.name
        assert response.data["step"] == Relocation.Step.PREPROCESSING.name
        assert response.data["scheduledCancelAtStep"] == Relocation.Step.NOTIFYING.name

    def test_good_already_cancelled(self):
        self.login_as(user=self.superuser, superuser=True)
        self.relocation.scheduled_cancel_at_step = Relocation.Step.IMPORTING.value
        self.relocation.save()
        response = self.get_success_response(
            self.relocation.uuid, atStep=Relocation.Step.IMPORTING.name, status_code=200
        )

        assert response.data["status"] == Relocation.Status.IN_PROGRESS.name
        assert response.data["step"] == Relocation.Step.PREPROCESSING.name
        assert response.data["scheduledCancelAtStep"] == Relocation.Step.IMPORTING.name

    def test_good_already_failed(self):
        self.login_as(user=self.superuser, superuser=True)
        self.relocation.status = Relocation.Status.FAILURE.value
        self.relocation.save()
        response = self.get_success_response(
            self.relocation.uuid, atStep=Relocation.Step.PREPROCESSING.name, status_code=200
        )

        assert response.data["status"] == Relocation.Status.FAILURE.name
        assert response.data["step"] == Relocation.Step.PREPROCESSING.name
        assert not response.data["scheduledCancelAtStep"]

    def test_bad_not_found(self):
        self.login_as(user=self.superuser, superuser=True)
        does_not_exist_uuid = uuid4().hex
        self.get_error_response(does_not_exist_uuid, status_code=404)

    def test_bad_already_succeeded(self):
        self.login_as(user=self.superuser, superuser=True)
        self.relocation.status = Relocation.Status.SUCCESS.value
        self.relocation.save()
        response = self.get_error_response(self.relocation.uuid, status_code=400)

        assert response.data.get("detail") is not None
        assert response.data.get("detail") == ERR_NOT_CANCELLABLE_STATUS

    def test_bad_invalid_step(self):
        self.login_as(user=self.superuser, superuser=True)
        response = self.get_error_response(
            self.relocation.uuid, atStep="nonexistent", status_code=400
        )

        assert response.data.get("detail") is not None
        assert response.data.get("detail") == ERR_UNKNOWN_RELOCATION_STEP.substitute(
            step="nonexistent"
        )

    def test_bad_unknown_step(self):
        self.login_as(user=self.superuser, superuser=True)
        response = self.get_error_response(
            self.relocation.uuid, atStep=Relocation.Step.UNKNOWN.name, status_code=400
        )

        assert response.data.get("detail") is not None
        assert response.data.get("detail") == ERR_COULD_NOT_CANCEL_RELOCATION_AT_STEP.substitute(
            step=Relocation.Step.UNKNOWN.name
        )

    def test_bad_current_step(self):
        self.login_as(user=self.superuser, superuser=True)
        response = self.get_error_response(
            self.relocation.uuid, atStep=Relocation.Step.PREPROCESSING.name, status_code=400
        )

        assert response.data.get("detail") is not None
        assert response.data.get("detail") == ERR_COULD_NOT_CANCEL_RELOCATION

    def test_bad_past_step(self):
        self.login_as(user=self.superuser, superuser=True)
        response = self.get_error_response(
            self.relocation.uuid, atStep=Relocation.Step.UPLOADING.name, status_code=400
        )

        assert response.data.get("detail") is not None
        assert response.data.get("detail") == ERR_COULD_NOT_CANCEL_RELOCATION_AT_STEP.substitute(
            step=Relocation.Step.UPLOADING.name
        )

    def test_bad_last_step_specified(self):
        self.login_as(user=self.superuser, superuser=True)
        response = self.get_error_response(
            self.relocation.uuid, atStep=Relocation.Step.COMPLETED.name, status_code=400
        )

        assert response.data.get("detail") is not None
        assert response.data.get("detail") == ERR_COULD_NOT_CANCEL_RELOCATION_AT_STEP.substitute(
            step=Relocation.Step.COMPLETED.name
        )

    def test_bad_last_step_automatic(self):
        self.login_as(user=self.superuser, superuser=True)
        self.relocation.step = Relocation.Step.NOTIFYING.value
        self.relocation.save()
        response = self.get_error_response(self.relocation.uuid, status_code=400)

        assert response.data.get("detail") is not None
        assert response.data.get("detail") == ERR_COULD_NOT_CANCEL_RELOCATION

    def test_bad_no_auth(self):
        self.get_error_response(self.relocation.uuid, status_code=401)

    def test_bad_no_superuser(self):
        self.login_as(user=self.superuser, superuser=False)
        self.get_error_response(self.relocation.uuid, status_code=403)
