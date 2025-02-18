from datetime import datetime, timezone
from unittest.mock import Mock, patch
from uuid import uuid4

from sentry.relocation.api.endpoints import (
    ERR_COULD_NOT_PAUSE_RELOCATION_AT_STEP,
    ERR_UNKNOWN_RELOCATION_STEP,
)
from sentry.relocation.api.endpoints.recover import (
    ERR_NOT_RECOVERABLE_STATUS,
    ERR_NOT_RECOVERABLE_STEP,
)
from sentry.relocation.models.relocation import Relocation
from sentry.relocation.tasks import MAX_FAST_TASK_ATTEMPTS
from sentry.relocation.utils import OrderedTask
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.options import override_options

TEST_DATE_ADDED = datetime(2023, 1, 23, 1, 23, 45, tzinfo=timezone.utc)


class RecoverRelocationTest(APITestCase):
    endpoint = "sentry-api-0-relocations-recover"
    method = "put"

    def setUp(self):
        super().setUp()
        self.owner = self.create_user(
            email="owner", is_superuser=False, is_staff=True, is_active=True
        )
        self.superuser = self.create_user(is_superuser=True)
        self.staff_user = self.create_user(is_staff=True)
        self.relocation: Relocation = Relocation.objects.create(
            date_added=TEST_DATE_ADDED,
            creator_id=self.superuser.id,
            owner_id=self.owner.id,
            status=Relocation.Status.FAILURE.value,
            step=Relocation.Step.PREPROCESSING.value,
            provenance=Relocation.Provenance.SELF_HOSTED.value,
            want_org_slugs=["foo"],
            want_usernames=["alice", "bob"],
            latest_notified=Relocation.EmailKind.STARTED.value,
            latest_task=OrderedTask.PREPROCESSING_COLLIDING_USERS.name,
            latest_task_attempts=MAX_FAST_TASK_ATTEMPTS,
        )

    @override_options({"staff.ga-rollout": True})
    @patch("sentry.relocation.tasks.preprocessing_colliding_users.delay")
    def test_good_recover_without_pause_as_staff(self, async_task_scheduled: Mock):
        self.login_as(user=self.staff_user, staff=True)
        response = self.get_success_response(self.relocation.uuid, status_code=200)

        assert response.data["status"] == Relocation.Status.IN_PROGRESS.name
        assert response.data["step"] == Relocation.Step.PREPROCESSING.name
        assert response.data["scheduledPauseAtStep"] not in response.data
        assert response.data["latestTask"] == OrderedTask.PREPROCESSING_COLLIDING_USERS.name
        assert response.data["latestTaskAttempts"] == MAX_FAST_TASK_ATTEMPTS - 1

        assert async_task_scheduled.call_count == 1
        assert async_task_scheduled.call_args.args == (str(self.relocation.uuid),)

    @patch("sentry.relocation.tasks.preprocessing_colliding_users.delay")
    def test_good_recover_without_pause_as_superuser(self, async_task_scheduled: Mock):
        self.login_as(user=self.superuser, superuser=True)
        response = self.get_success_response(self.relocation.uuid, status_code=200)

        assert response.data["status"] == Relocation.Status.IN_PROGRESS.name
        assert response.data["step"] == Relocation.Step.PREPROCESSING.name
        assert response.data["scheduledPauseAtStep"] not in response.data
        assert response.data["latestTask"] == OrderedTask.PREPROCESSING_COLLIDING_USERS.name
        assert response.data["latestTaskAttempts"] == MAX_FAST_TASK_ATTEMPTS - 1

        assert async_task_scheduled.call_count == 1
        assert async_task_scheduled.call_args.args == (str(self.relocation.uuid),)

    @override_options({"staff.ga-rollout": True})
    @patch("sentry.relocation.tasks.preprocessing_colliding_users.delay")
    def test_good_recover_with_pause_as_staff(self, async_task_scheduled: Mock):
        self.login_as(user=self.staff_user, staff=True)
        response = self.get_success_response(
            self.relocation.uuid, untilStep=Relocation.Step.VALIDATING.name, status_code=200
        )

        assert response.data["status"] == Relocation.Status.IN_PROGRESS.name
        assert response.data["step"] == Relocation.Step.PREPROCESSING.name
        assert response.data["scheduledPauseAtStep"] == Relocation.Step.VALIDATING.name
        assert response.data["latestTask"] == OrderedTask.PREPROCESSING_COLLIDING_USERS.name
        assert response.data["latestTaskAttempts"] == MAX_FAST_TASK_ATTEMPTS - 1

        assert async_task_scheduled.call_count == 1
        assert async_task_scheduled.call_args.args == (str(self.relocation.uuid),)

    @patch("sentry.relocation.tasks.preprocessing_colliding_users.delay")
    def test_good_recover_with_pause_as_superuser(self, async_task_scheduled: Mock):
        self.login_as(user=self.superuser, superuser=True)
        response = self.get_success_response(
            self.relocation.uuid, untilStep=Relocation.Step.VALIDATING.name, status_code=200
        )

        assert response.data["status"] == Relocation.Status.IN_PROGRESS.name
        assert response.data["step"] == Relocation.Step.PREPROCESSING.name
        assert response.data["scheduledPauseAtStep"] == Relocation.Step.VALIDATING.name
        assert response.data["latestTask"] == OrderedTask.PREPROCESSING_COLLIDING_USERS.name
        assert response.data["latestTaskAttempts"] == MAX_FAST_TASK_ATTEMPTS - 1

        assert async_task_scheduled.call_count == 1
        assert async_task_scheduled.call_args.args == (str(self.relocation.uuid),)

    def test_bad_not_found(self):
        self.login_as(user=self.superuser, superuser=True)
        does_not_exist_uuid = uuid4().hex
        self.get_error_response(does_not_exist_uuid, status_code=404)

    @patch("sentry.relocation.tasks.preprocessing_colliding_users.delay")
    def test_bad_not_yet_failed(self, async_task_scheduled: Mock):
        self.login_as(user=self.superuser, superuser=True)
        self.relocation.status = Relocation.Status.PAUSE.value
        self.relocation.save()
        response = self.get_error_response(self.relocation.uuid, status_code=400)

        assert response.data.get("detail") is not None
        assert response.data.get("detail") == ERR_NOT_RECOVERABLE_STATUS.substitute(
            status=Relocation.Status.PAUSE.name
        )

        assert async_task_scheduled.call_count == 0

    @patch("sentry.relocation.tasks.preprocessing_colliding_users.delay")
    def test_bad_invalid_pause_step(self, async_task_scheduled: Mock):
        self.login_as(user=self.superuser, superuser=True)
        response = self.get_error_response(
            self.relocation.uuid, untilStep="nonexistent", status_code=400
        )

        assert response.data.get("detail") is not None
        assert response.data.get("detail") == ERR_UNKNOWN_RELOCATION_STEP.substitute(
            step="nonexistent"
        )

        assert async_task_scheduled.call_count == 0

    @patch("sentry.relocation.tasks.preprocessing_colliding_users.delay")
    def test_bad_unknown_pause_step(self, async_task_scheduled: Mock):
        self.login_as(user=self.superuser, superuser=True)
        response = self.get_error_response(
            self.relocation.uuid, untilStep=Relocation.Step.UNKNOWN.name, status_code=400
        )

        assert response.data.get("detail") is not None
        assert response.data.get("detail") == ERR_COULD_NOT_PAUSE_RELOCATION_AT_STEP.substitute(
            step=Relocation.Step.UNKNOWN.name
        )

        assert async_task_scheduled.call_count == 0

    @patch("sentry.relocation.tasks.preprocessing_colliding_users.delay")
    def test_bad_already_completed_pause_step(self, async_task_scheduled: Mock):
        self.login_as(user=self.superuser, superuser=True)
        response = self.get_error_response(
            self.relocation.uuid, untilStep=Relocation.Step.PREPROCESSING.name, status_code=400
        )

        assert response.data.get("detail") is not None
        assert response.data.get("detail") == ERR_COULD_NOT_PAUSE_RELOCATION_AT_STEP.substitute(
            step=Relocation.Step.PREPROCESSING.name
        )

        assert async_task_scheduled.call_count == 0

    @patch("sentry.relocation.tasks.preprocessing_colliding_users.delay")
    def test_bad_cannot_recover_at_validation_step(self, async_task_scheduled: Mock):
        self.login_as(user=self.superuser, superuser=True)
        self.relocation.step = Relocation.Step.VALIDATING.value
        self.relocation.latest_task = OrderedTask.VALIDATING_POLL.name
        self.relocation.save()
        response = self.get_error_response(self.relocation.uuid, status_code=400)

        assert response.data.get("detail") is not None
        assert response.data.get("detail") == ERR_NOT_RECOVERABLE_STEP

        assert async_task_scheduled.call_count == 0

    @patch("sentry.relocation.tasks.preprocessing_colliding_users.delay")
    def test_bad_no_auth(self, async_task_scheduled: Mock):
        self.get_error_response(self.relocation.uuid, status_code=401)

        assert async_task_scheduled.call_count == 0

    @patch("sentry.relocation.tasks.preprocessing_colliding_users.delay")
    def test_bad_no_superuser(self, async_task_scheduled: Mock):
        self.login_as(user=self.superuser, superuser=False)
        self.get_error_response(self.relocation.uuid, status_code=403)

        assert async_task_scheduled.call_count == 0
