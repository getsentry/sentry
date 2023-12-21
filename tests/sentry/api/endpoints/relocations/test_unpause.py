from datetime import datetime, timezone
from unittest.mock import Mock, patch
from uuid import uuid4

from sentry.api.endpoints.relocations import (
    ERR_COULD_NOT_PAUSE_RELOCATION_AT_STEP,
    ERR_UNKNOWN_RELOCATION_STEP,
)
from sentry.api.endpoints.relocations.unpause import ERR_NOT_UNPAUSABLE_STATUS
from sentry.models.relocation import Relocation
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test
from sentry.utils.relocation import OrderedTask

TEST_DATE_ADDED = datetime(2023, 1, 23, 1, 23, 45, tzinfo=timezone.utc)


@region_silo_test
class UnpauseRelocationTest(APITestCase):
    endpoint = "sentry-api-0-relocations-unpause"

    def setUp(self):
        super().setUp()
        self.owner = self.create_user(
            email="owner", is_superuser=False, is_staff=True, is_active=True
        )
        self.superuser = self.create_user(
            "superuser", is_superuser=True, is_staff=True, is_active=True
        )
        self.relocation: Relocation = Relocation.objects.create(
            date_added=TEST_DATE_ADDED,
            creator_id=self.superuser.id,
            owner_id=self.owner.id,
            status=Relocation.Status.PAUSE.value,
            step=Relocation.Step.PREPROCESSING.value,
            want_org_slugs='["foo"]',
            want_usernames='["alice", "bob"]',
            latest_notified=Relocation.EmailKind.STARTED.value,
            latest_task=OrderedTask.PREPROCESSING_SCAN.name,
            latest_task_attempts=1,
        )

    @patch("sentry.tasks.relocation.preprocessing_scan.delay")
    def test_good_unpause_until_validating(self, async_task_scheduled: Mock):
        self.login_as(user=self.superuser, superuser=True)
        response = self.client.put(
            f"/api/0/relocations/{str(self.relocation.uuid)}/unpause/",
            {"untilStep": Relocation.Step.VALIDATING.name},
        )

        assert response.status_code == 200
        assert response.data["status"] == Relocation.Status.IN_PROGRESS.name
        assert response.data["step"] == Relocation.Step.PREPROCESSING.name
        assert response.data["scheduledPauseAtStep"] == Relocation.Step.VALIDATING.name

        assert async_task_scheduled.call_count == 1
        assert async_task_scheduled.call_args.args == (str(self.relocation.uuid),)

    @patch("sentry.tasks.relocation.validating_start.delay")
    def test_good_unpause_until_importing(self, async_task_scheduled: Mock):
        self.login_as(user=self.superuser, superuser=True)
        self.relocation.step = Relocation.Step.VALIDATING.value
        self.relocation.save()
        response = self.client.put(
            f"/api/0/relocations/{str(self.relocation.uuid)}/unpause/",
            {"untilStep": Relocation.Step.IMPORTING.name},
        )

        assert response.status_code == 200
        assert response.data["status"] == Relocation.Status.IN_PROGRESS.name
        assert response.data["step"] == Relocation.Step.VALIDATING.name
        assert response.data["scheduledPauseAtStep"] == Relocation.Step.IMPORTING.name

        assert async_task_scheduled.call_count == 1
        assert async_task_scheduled.call_args.args == (str(self.relocation.uuid),)

    @patch("sentry.tasks.relocation.importing.delay")
    def test_good_unpause_until_postprocessing(self, async_task_scheduled: Mock):
        self.login_as(user=self.superuser, superuser=True)
        self.relocation.step = Relocation.Step.IMPORTING.value
        self.relocation.save()
        response = self.client.put(
            f"/api/0/relocations/{str(self.relocation.uuid)}/unpause/",
            {"untilStep": Relocation.Step.POSTPROCESSING.name},
        )

        assert response.status_code == 200
        assert response.data["status"] == Relocation.Status.IN_PROGRESS.name
        assert response.data["step"] == Relocation.Step.IMPORTING.name
        assert response.data["scheduledPauseAtStep"] == Relocation.Step.POSTPROCESSING.name

        assert async_task_scheduled.call_count == 1
        assert async_task_scheduled.call_args.args == (str(self.relocation.uuid),)

    @patch("sentry.tasks.relocation.postprocessing.delay")
    def test_good_unpause_until_notifying(self, async_task_scheduled: Mock):
        self.login_as(user=self.superuser, superuser=True)
        self.relocation.step = Relocation.Step.POSTPROCESSING.value
        self.relocation.save()
        response = self.client.put(
            f"/api/0/relocations/{str(self.relocation.uuid)}/unpause/",
            {"untilStep": Relocation.Step.NOTIFYING.name},
        )

        assert response.status_code == 200
        assert response.data["status"] == Relocation.Status.IN_PROGRESS.name
        assert response.data["step"] == Relocation.Step.POSTPROCESSING.name
        assert response.data["scheduledPauseAtStep"] == Relocation.Step.NOTIFYING.name

        assert async_task_scheduled.call_count == 1
        assert async_task_scheduled.call_args.args == (str(self.relocation.uuid),)

    @patch("sentry.tasks.relocation.preprocessing_scan.delay")
    def test_good_change_pending_pause_later(self, async_task_scheduled: Mock):
        self.login_as(user=self.superuser, superuser=True)
        self.relocation.status = Relocation.Status.IN_PROGRESS.value
        self.relocation.step = Relocation.Step.VALIDATING.value
        self.relocation.scheduled_pause_at_step = Relocation.Step.POSTPROCESSING.value
        self.relocation.save()
        response = self.client.put(
            f"/api/0/relocations/{str(self.relocation.uuid)}/unpause/",
            {"untilStep": Relocation.Step.NOTIFYING.name},
        )

        assert response.status_code == 200
        assert response.data["status"] == Relocation.Status.IN_PROGRESS.name
        assert response.data["step"] == Relocation.Step.VALIDATING.name
        assert response.data["scheduledPauseAtStep"] == Relocation.Step.NOTIFYING.name

        assert async_task_scheduled.call_count == 0

    @patch("sentry.tasks.relocation.preprocessing_scan.delay")
    def test_good_change_pending_pause_sooner(self, async_task_scheduled: Mock):
        self.login_as(user=self.superuser, superuser=True)
        self.relocation.status = Relocation.Status.IN_PROGRESS.value
        self.relocation.step = Relocation.Step.VALIDATING.value
        self.relocation.scheduled_pause_at_step = Relocation.Step.POSTPROCESSING.value
        self.relocation.save()
        response = self.client.put(
            f"/api/0/relocations/{str(self.relocation.uuid)}/unpause/",
            {"untilStep": Relocation.Step.IMPORTING.name},
        )

        assert response.status_code == 200
        assert response.data["status"] == Relocation.Status.IN_PROGRESS.name
        assert response.data["step"] == Relocation.Step.VALIDATING.name
        assert response.data["scheduledPauseAtStep"] == Relocation.Step.IMPORTING.name

        assert async_task_scheduled.call_count == 0

    @patch("sentry.tasks.relocation.preprocessing_scan.delay")
    def test_good_remove_pending_pause(self, async_task_scheduled: Mock):
        self.login_as(user=self.superuser, superuser=True)
        self.relocation.status = Relocation.Status.IN_PROGRESS.value
        self.relocation.step = Relocation.Step.VALIDATING.value
        self.relocation.scheduled_pause_at_step = Relocation.Step.POSTPROCESSING.value
        self.relocation.save()
        response = self.client.put(f"/api/0/relocations/{str(self.relocation.uuid)}/unpause/")

        assert response.status_code == 200
        assert response.data["status"] == Relocation.Status.IN_PROGRESS.name
        assert response.data["step"] == Relocation.Step.VALIDATING.name
        assert response.data["scheduledPauseAtStep"] is None

        assert async_task_scheduled.call_count == 0

    @patch("sentry.tasks.relocation.notifying_users.delay")
    def test_good_unpause_no_follow_up_step(self, async_task_scheduled: Mock):
        self.login_as(user=self.superuser, superuser=True)
        self.relocation.step = Relocation.Step.NOTIFYING.value
        self.relocation.save()
        response = self.client.put(f"/api/0/relocations/{str(self.relocation.uuid)}/unpause/")

        assert response.status_code == 200
        assert response.data["status"] == Relocation.Status.IN_PROGRESS.name
        assert response.data["step"] == Relocation.Step.NOTIFYING.name
        assert not response.data["scheduledPauseAtStep"]

        assert async_task_scheduled.call_count == 1
        assert async_task_scheduled.call_args.args == (str(self.relocation.uuid),)

    @patch("sentry.tasks.relocation.preprocessing_scan.delay")
    def test_bad_not_found(self, async_task_scheduled: Mock):
        self.login_as(user=self.superuser, superuser=True)
        does_not_exist_uuid = uuid4().hex
        response = self.client.put(f"/api/0/relocations/{str(does_not_exist_uuid)}/unpause/")

        assert response.status_code == 404

    @patch("sentry.tasks.relocation.preprocessing_scan.delay")
    def test_bad_already_completed(self, async_task_scheduled: Mock):
        self.login_as(user=self.superuser, superuser=True)
        self.relocation.status = Relocation.Status.FAILURE.value
        self.relocation.save()
        response = self.client.put(f"/api/0/relocations/{str(self.relocation.uuid)}/unpause/")

        assert response.status_code == 400
        assert response.data.get("detail") is not None
        assert response.data.get("detail") == ERR_NOT_UNPAUSABLE_STATUS.substitute(
            status=Relocation.Status.FAILURE.name
        )

        assert async_task_scheduled.call_count == 0

    @patch("sentry.tasks.relocation.preprocessing_scan.delay")
    def test_bad_already_paused(self, async_task_scheduled: Mock):
        self.login_as(user=self.superuser, superuser=True)
        self.relocation.status = Relocation.Status.IN_PROGRESS.value
        self.relocation.save()
        response = self.client.put(f"/api/0/relocations/{str(self.relocation.uuid)}/unpause/")

        assert response.status_code == 400
        assert response.data.get("detail") is not None
        assert response.data.get("detail") == ERR_NOT_UNPAUSABLE_STATUS.substitute(
            status=Relocation.Status.IN_PROGRESS.name
        )

        assert async_task_scheduled.call_count == 0

    @patch("sentry.tasks.relocation.preprocessing_scan.delay")
    def test_bad_invalid_step(self, async_task_scheduled: Mock):
        self.login_as(user=self.superuser, superuser=True)
        response = self.client.put(
            f"/api/0/relocations/{str(self.relocation.uuid)}/unpause/",
            {"untilStep": "nonexistent"},
        )

        assert response.status_code == 400
        assert response.data.get("detail") is not None
        assert response.data.get("detail") == ERR_UNKNOWN_RELOCATION_STEP.substitute(
            step="nonexistent"
        )

        assert async_task_scheduled.call_count == 0

    @patch("sentry.tasks.relocation.preprocessing_scan.delay")
    def test_bad_unknown_step(self, async_task_scheduled: Mock):
        self.login_as(user=self.superuser, superuser=True)
        response = self.client.put(
            f"/api/0/relocations/{str(self.relocation.uuid)}/unpause/",
            {"untilStep": Relocation.Step.UNKNOWN.name},
        )

        assert response.status_code == 400
        assert response.data.get("detail") is not None
        assert response.data.get("detail") == ERR_COULD_NOT_PAUSE_RELOCATION_AT_STEP.substitute(
            step=Relocation.Step.UNKNOWN.name
        )

        assert async_task_scheduled.call_count == 0

    @patch("sentry.tasks.relocation.preprocessing_scan.delay")
    def test_bad_current_step(self, async_task_scheduled: Mock):
        self.login_as(user=self.superuser, superuser=True)
        response = self.client.put(
            f"/api/0/relocations/{str(self.relocation.uuid)}/unpause/",
            {"untilStep": Relocation.Step.PREPROCESSING.name},
        )

        assert response.status_code == 400
        assert response.data.get("detail") is not None
        assert response.data.get("detail") == ERR_COULD_NOT_PAUSE_RELOCATION_AT_STEP.substitute(
            step=Relocation.Step.PREPROCESSING.name
        )

        assert async_task_scheduled.call_count == 0

    @patch("sentry.tasks.relocation.preprocessing_scan.delay")
    def test_bad_past_step(self, async_task_scheduled: Mock):
        self.login_as(user=self.superuser, superuser=True)
        response = self.client.put(
            f"/api/0/relocations/{str(self.relocation.uuid)}/unpause/",
            {"untilStep": Relocation.Step.UPLOADING.name},
        )

        assert response.status_code == 400
        assert response.data.get("detail") is not None
        assert response.data.get("detail") == ERR_COULD_NOT_PAUSE_RELOCATION_AT_STEP.substitute(
            step=Relocation.Step.UPLOADING.name
        )

        assert async_task_scheduled.call_count == 0

    @patch("sentry.tasks.relocation.preprocessing_scan.delay")
    def test_bad_last_step(self, async_task_scheduled: Mock):
        self.login_as(user=self.superuser, superuser=True)
        response = self.client.put(
            f"/api/0/relocations/{str(self.relocation.uuid)}/unpause/",
            {"untilStep": Relocation.Step.COMPLETED.name},
        )

        assert response.status_code == 400
        assert response.data.get("detail") is not None
        assert response.data.get("detail") == ERR_COULD_NOT_PAUSE_RELOCATION_AT_STEP.substitute(
            step=Relocation.Step.COMPLETED.name
        )

        assert async_task_scheduled.call_count == 0

    @patch("sentry.tasks.relocation.preprocessing_scan.delay")
    def test_bad_no_auth(self, async_task_scheduled: Mock):
        response = self.client.put(f"/api/0/relocations/{str(self.relocation.uuid)}/unpause/")

        assert response.status_code == 401
        assert async_task_scheduled.call_count == 0

    @patch("sentry.tasks.relocation.preprocessing_scan.delay")
    def test_bad_no_superuser(self, async_task_scheduled: Mock):
        self.login_as(user=self.superuser, superuser=False)
        response = self.client.put(f"/api/0/relocations/{str(self.relocation.uuid)}/unpause/")

        assert response.status_code == 403
        assert async_task_scheduled.call_count == 0
