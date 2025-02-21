import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import Mock, call, patch
from uuid import UUID

import orjson
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status

from sentry.backup.crypto import LocalFileEncryptor, create_encrypted_export_tarball
from sentry.relocation.api.endpoints import ERR_FEATURE_DISABLED
from sentry.relocation.api.endpoints.index import (
    ERR_INVALID_ORG_SLUG,
    ERR_INVALID_OWNER,
    ERR_OWNER_NOT_FOUND,
    ERR_THROTTLED_RELOCATION,
    ERR_UNKNOWN_RELOCATION_STATUS,
    RelocationIndexEndpoint,
)
from sentry.relocation.models.relocation import Relocation, RelocationFile
from sentry.relocation.utils import OrderedTask
from sentry.testutils.cases import APITestCase
from sentry.testutils.factories import get_fixture_path
from sentry.testutils.helpers.backups import generate_rsa_key_pair
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.helpers.options import override_options

FRESH_INSTALL_PATH = get_fixture_path("backup", "fresh-install.json")
TEST_DATE_ADDED = datetime(2023, 1, 23, 1, 23, 45, tzinfo=timezone.utc)
TEST_DATE_UPDATED = datetime(2023, 1, 23, 1, 24, 45, tzinfo=timezone.utc)


@freeze_time(TEST_DATE_UPDATED)
class GetRelocationsTest(APITestCase):
    endpoint = "sentry-api-0-relocations-index"

    def setUp(self):
        super().setUp()
        self.owner = self.create_user(
            email="owner", is_superuser=False, is_staff=False, is_active=True
        )
        self.superuser = self.create_user(is_superuser=True)
        self.staff_user = self.create_user(is_staff=True)

        # Add 1 relocation of each status.
        common = {
            "creator_id": self.superuser.id,
            "latest_task_attempts": 1,
        }
        Relocation.objects.create(
            uuid=UUID("ccef828a-03d8-4dd0-918a-487ffecf8717"),
            date_added=TEST_DATE_ADDED + timedelta(seconds=1),
            owner_id=self.owner.id,
            status=Relocation.Status.IN_PROGRESS.value,
            step=Relocation.Step.IMPORTING.value,
            provenance=Relocation.Provenance.SELF_HOSTED.value,
            scheduled_pause_at_step=Relocation.Step.POSTPROCESSING.value,
            want_org_slugs=["foo"],
            want_usernames=["alice", "bob"],
            latest_notified=Relocation.EmailKind.STARTED.value,
            latest_task=OrderedTask.IMPORTING.name,
            **common,
        )
        Relocation.objects.create(
            uuid=UUID("af3d45ee-ce76-4de0-90c1-fc739da29523"),
            date_added=TEST_DATE_ADDED + timedelta(seconds=2),
            owner_id=self.owner.id,
            status=Relocation.Status.PAUSE.value,
            step=Relocation.Step.IMPORTING.value,
            provenance=Relocation.Provenance.SAAS_TO_SAAS.value,
            want_org_slugs=["bar"],
            want_usernames=["charlie", "denise"],
            latest_notified=Relocation.EmailKind.STARTED.value,
            latest_task=OrderedTask.IMPORTING.name,
            **common,
        )
        Relocation.objects.create(
            uuid=UUID("1ecc8862-7a3a-4114-bbc1-b6b80eb90197"),
            date_added=TEST_DATE_ADDED + timedelta(seconds=3),
            owner_id=self.superuser.id,
            status=Relocation.Status.SUCCESS.value,
            step=Relocation.Step.COMPLETED.value,
            provenance=Relocation.Provenance.SELF_HOSTED.value,
            want_org_slugs=["foo"],
            want_usernames=["emily", "fred"],
            latest_notified=Relocation.EmailKind.SUCCEEDED.value,
            latest_task=OrderedTask.COMPLETED.name,
            latest_unclaimed_emails_sent_at=TEST_DATE_UPDATED,
            **common,
        )
        Relocation.objects.create(
            uuid=UUID("8f478ea5-6250-4133-8539-2c0103f9d271"),
            date_added=TEST_DATE_ADDED + timedelta(seconds=4),
            owner_id=self.superuser.id,
            status=Relocation.Status.FAILURE.value,
            failure_reason="Some failure reason",
            step=Relocation.Step.VALIDATING.value,
            provenance=Relocation.Provenance.SAAS_TO_SAAS.value,
            scheduled_cancel_at_step=Relocation.Step.IMPORTING.value,
            want_org_slugs=["qux"],
            want_usernames=["alice", "greg"],
            latest_notified=Relocation.EmailKind.FAILED.value,
            latest_task=OrderedTask.VALIDATING_COMPLETE.name,
            **common,
        )

        self.success_uuid = Relocation.objects.get(status=Relocation.Status.SUCCESS.value)

    @override_options({"staff.ga-rollout": True})
    def test_good_staff_simple(self):
        self.login_as(user=self.staff_user, staff=True)
        response = self.get_success_response(status_code=200)

        assert len(response.data) == 4

    def test_good_superuser_simple(self):
        self.login_as(user=self.superuser, superuser=True)
        response = self.get_success_response(status_code=200)

        assert len(response.data) == 4

    def test_good_status_in_progress(self):
        self.login_as(user=self.superuser, superuser=True)
        response = self.get_success_response(
            status=Relocation.Status.IN_PROGRESS.name, status_code=200
        )

        assert len(response.data) == 1
        assert response.data[0]["status"] == Relocation.Status.IN_PROGRESS.name
        assert response.data[0]["provenance"] == Relocation.Provenance.SELF_HOSTED.name
        assert response.data[0]["creator"]["id"] == str(self.superuser.id)
        assert response.data[0]["creator"]["email"] == str(self.superuser.email)
        assert response.data[0]["creator"]["username"] == str(self.superuser.username)
        assert response.data[0]["owner"]["id"] == str(self.owner.id)
        assert response.data[0]["owner"]["email"] == str(self.owner.email)
        assert response.data[0]["owner"]["username"] == str(self.owner.username)

    def test_good_status_pause(self):
        self.login_as(user=self.superuser, superuser=True)
        response = self.get_success_response(status=Relocation.Status.PAUSE.name, status_code=200)

        assert len(response.data) == 1
        assert response.data[0]["status"] == Relocation.Status.PAUSE.name
        assert response.data[0]["provenance"] == Relocation.Provenance.SAAS_TO_SAAS.name

    def test_good_status_success(self):
        self.login_as(user=self.superuser, superuser=True)
        response = self.get_success_response(status=Relocation.Status.SUCCESS.name, status_code=200)

        assert len(response.data) == 1
        assert response.data[0]["status"] == Relocation.Status.SUCCESS.name
        assert response.data[0]["provenance"] == Relocation.Provenance.SELF_HOSTED.name

    def test_good_status_failure(self):
        self.login_as(user=self.superuser, superuser=True)
        response = self.get_success_response(status=Relocation.Status.FAILURE.name, status_code=200)
        assert response.data[0]["status"] == Relocation.Status.FAILURE.name
        assert response.data[0]["provenance"] == Relocation.Provenance.SAAS_TO_SAAS.name

    def test_good_single_query_partial_uuid(self):
        self.login_as(user=self.superuser, superuser=True)
        response = self.get_success_response(
            qs_params={
                "query": "ccef828a",
            },
            status_code=200,
        )
        assert len(response.data) == 1
        assert response.data[0]["status"] == Relocation.Status.IN_PROGRESS.name

    def test_good_single_query_full_uuid(self):
        self.login_as(user=self.superuser, superuser=True)
        response = self.get_success_response(
            qs_params={
                "query": "af3d45ee-ce76-4de0-90c1-fc739da29523",
            },
            status_code=200,
        )

        assert len(response.data) == 1
        assert response.data[0]["status"] == Relocation.Status.PAUSE.name

    def test_good_single_query_org_slug(self):
        self.login_as(user=self.superuser, superuser=True)
        response = self.get_success_response(
            qs_params={
                "query": "foo",
            },
            status_code=200,
        )

        assert len(response.data) == 2
        assert response.data[0]["status"] == Relocation.Status.SUCCESS.name
        assert response.data[1]["status"] == Relocation.Status.IN_PROGRESS.name

    def test_good_single_query_username(self):
        self.login_as(user=self.superuser, superuser=True)
        response = self.get_success_response(
            qs_params={
                "query": "alice",
            },
            status_code=200,
        )

        assert len(response.data) == 2
        assert response.data[0]["status"] == Relocation.Status.FAILURE.name
        assert response.data[1]["status"] == Relocation.Status.IN_PROGRESS.name

    def test_good_single_query_letter(self):
        self.login_as(user=self.superuser, superuser=True)
        response = self.get_success_response(
            qs_params={
                "query": "b",
            },
            status_code=200,
        )
        assert len(response.data) == 3
        assert response.data[0]["status"] == Relocation.Status.SUCCESS.name
        assert response.data[1]["status"] == Relocation.Status.PAUSE.name
        assert response.data[2]["status"] == Relocation.Status.IN_PROGRESS.name

    def test_good_multiple_queries(self):
        self.login_as(user=self.superuser, superuser=True)
        response = self.get_success_response(
            qs_params={
                "query": "foo alice",
            },
            status_code=200,
        )

        assert len(response.data) == 1
        assert response.data[0]["status"] == Relocation.Status.IN_PROGRESS.name

    def test_good_superuser_but_not_enabled(self):
        self.login_as(user=self.superuser, superuser=False)
        response = self.get_success_response(status_code=200)

        # Only show user's own relocations.

        assert len(response.data) == 2
        assert response.data[0]["status"] == Relocation.Status.FAILURE.name
        assert response.data[1]["status"] == Relocation.Status.SUCCESS.name

    def test_good_no_regular_user(self):
        self.login_as(user=self.owner, superuser=False)
        response = self.get_success_response(status_code=200)

        # Only show user's own relocations.

        assert len(response.data) == 2
        assert response.data[0]["status"] == Relocation.Status.PAUSE.name
        assert response.data[1]["status"] == Relocation.Status.IN_PROGRESS.name

    def test_good_no_regular_user_with_query(self):
        self.login_as(user=self.owner, superuser=False)
        response = self.get_success_response(
            qs_params={
                "query": "alice",
            },
            status_code=200,
        )

        # Only show user's own relocations.
        assert len(response.data) == 1
        assert response.data[0]["status"] == Relocation.Status.IN_PROGRESS.name

    def test_bad_unknown_status(self):
        self.login_as(user=self.superuser, superuser=True)
        response = self.get_error_response(status="nonexistent", status_code=400)

        assert response.data.get("detail") is not None
        assert response.data.get("detail") == ERR_UNKNOWN_RELOCATION_STATUS.substitute(
            status="nonexistent"
        )

    def test_bad_no_auth(self):
        self.get_error_response(status_code=401)


@patch("sentry.analytics.record")
@patch("sentry.signals.relocation_link_promo_code.send_robust")
class PostRelocationsTest(APITestCase):
    endpoint = "sentry-api-0-relocations-index"
    method = "POST"

    def setUp(self):
        super().setUp()
        self.owner = self.create_user(
            email="owner", is_superuser=False, is_staff=False, is_active=True
        )
        self.superuser = self.create_user(is_superuser=True)
        self.staff_user = self.create_user(is_staff=True)

    def tmp_keys(self, tmp_dir: str) -> tuple[Path, Path]:
        (priv_key_pem, pub_key_pem) = generate_rsa_key_pair()
        tmp_priv_key_path = Path(tmp_dir).joinpath("key")
        with open(tmp_priv_key_path, "wb") as f:
            f.write(priv_key_pem)

        tmp_pub_key_path = Path(tmp_dir).joinpath("key.pub")
        with open(tmp_pub_key_path, "wb") as f:
            f.write(pub_key_pem)

        return (tmp_priv_key_path, tmp_pub_key_path)

    @override_options({"relocation.enabled": True, "relocation.daily-limit.small": 1})
    @patch("sentry.relocation.tasks.uploading_start.apply_async")
    def test_good_simple(
        self,
        uploading_start_mock: Mock,
        relocation_link_promo_code_signal_mock: Mock,
        analytics_record_mock: Mock,
    ):
        self.login_as(user=self.owner, superuser=False)
        relocation_count = Relocation.objects.count()
        relocation_file_count = RelocationFile.objects.count()

        with tempfile.TemporaryDirectory() as tmp_dir:
            (_, tmp_pub_key_path) = self.tmp_keys(tmp_dir)
            with open(FRESH_INSTALL_PATH, "rb") as f:
                data = orjson.loads(f.read())
                with open(tmp_pub_key_path, "rb") as p:
                    response = self.get_success_response(
                        owner=self.owner.username,
                        file=SimpleUploadedFile(
                            "export.tar",
                            create_encrypted_export_tarball(data, LocalFileEncryptor(p)).getvalue(),
                            content_type="application/tar",
                        ),
                        orgs="testing",
                        format="multipart",
                        status_code=201,
                    )

        assert response.data["status"] == Relocation.Status.IN_PROGRESS.name
        assert response.data["step"] == Relocation.Step.UPLOADING.name
        assert response.data["provenance"] == Relocation.Provenance.SELF_HOSTED.name
        assert response.data["scheduledPauseAtStep"] is None
        assert response.data["creator"]["id"] == str(self.owner.id)
        assert response.data["creator"]["email"] == str(self.owner.email)
        assert response.data["creator"]["username"] == str(self.owner.username)
        assert response.data["owner"]["id"] == str(self.owner.id)
        assert response.data["owner"]["email"] == str(self.owner.email)
        assert response.data["owner"]["username"] == str(self.owner.username)

        relocation: Relocation = Relocation.objects.get(owner_id=self.owner.id)
        assert str(relocation.uuid) == response.data["uuid"]
        assert relocation.want_org_slugs == ["testing"]
        assert Relocation.objects.count() == relocation_count + 1
        assert RelocationFile.objects.count() == relocation_file_count + 1

        assert uploading_start_mock.call_count == 1
        uploading_start_mock.assert_called_with(args=[UUID(response.data["uuid"]), None, None])

        assert analytics_record_mock.call_count == 1
        analytics_record_mock.assert_called_with(
            "relocation.created",
            creator_id=int(response.data["creator"]["id"]),
            owner_id=int(response.data["owner"]["id"]),
            uuid=response.data["uuid"],
        )

        assert relocation_link_promo_code_signal_mock.call_count == 1
        relocation_link_promo_code_signal_mock.assert_called_with(
            relocation_uuid=UUID(response.data["uuid"]),
            promo_code=None,
            sender=RelocationIndexEndpoint,
        )

    @override_options({"relocation.enabled": True, "relocation.daily-limit.small": 1})
    @patch("sentry.relocation.tasks.uploading_start.apply_async")
    def test_good_promo_code(
        self,
        uploading_start_mock: Mock,
        relocation_link_promo_code_signal_mock: Mock,
        analytics_record_mock: Mock,
    ):
        self.login_as(user=self.owner, superuser=False)
        relocation_count = Relocation.objects.count()
        relocation_file_count = RelocationFile.objects.count()

        with tempfile.TemporaryDirectory() as tmp_dir:
            (_, tmp_pub_key_path) = self.tmp_keys(tmp_dir)
            with open(FRESH_INSTALL_PATH, "rb") as f:
                data = orjson.loads(f.read())
                with open(tmp_pub_key_path, "rb") as p:
                    response = self.get_success_response(
                        owner=self.owner.username,
                        file=SimpleUploadedFile(
                            "export.tar",
                            create_encrypted_export_tarball(data, LocalFileEncryptor(p)).getvalue(),
                            content_type="application/tar",
                        ),
                        orgs="testing",
                        promo_code="free_hugs",
                        format="multipart",
                        status_code=201,
                    )

        assert response.data["status"] == Relocation.Status.IN_PROGRESS.name
        assert response.data["step"] == Relocation.Step.UPLOADING.name
        assert response.data["provenance"] == Relocation.Provenance.SELF_HOSTED.name
        assert response.data["scheduledPauseAtStep"] is None
        assert response.data["creator"]["id"] == str(self.owner.id)
        assert response.data["creator"]["email"] == str(self.owner.email)
        assert response.data["creator"]["username"] == str(self.owner.username)
        assert response.data["owner"]["id"] == str(self.owner.id)
        assert response.data["owner"]["email"] == str(self.owner.email)
        assert response.data["owner"]["username"] == str(self.owner.username)

        relocation: Relocation = Relocation.objects.get(owner_id=self.owner.id)
        assert str(relocation.uuid) == response.data["uuid"]
        assert relocation.want_org_slugs == ["testing"]
        assert Relocation.objects.count() == relocation_count + 1
        assert RelocationFile.objects.count() == relocation_file_count + 1

        assert uploading_start_mock.call_count == 1
        uploading_start_mock.assert_called_with(args=[UUID(response.data["uuid"]), None, None])

        assert analytics_record_mock.call_count == 1
        analytics_record_mock.assert_called_with(
            "relocation.created",
            creator_id=int(response.data["creator"]["id"]),
            owner_id=int(response.data["owner"]["id"]),
            uuid=response.data["uuid"],
        )

        assert relocation_link_promo_code_signal_mock.call_count == 1
        relocation_link_promo_code_signal_mock.assert_called_with(
            relocation_uuid=UUID(response.data["uuid"]),
            promo_code="free_hugs",
            sender=RelocationIndexEndpoint,
        )

    @override_options(
        {
            "relocation.enabled": True,
            "relocation.daily-limit.small": 1,
            "relocation.autopause.self-hosted": "IMPORTING",
        }
    )
    @patch("sentry.relocation.tasks.uploading_start.apply_async")
    def test_good_with_valid_autopause_option(
        self,
        uploading_start_mock: Mock,
        relocation_link_promo_code_signal_mock: Mock,
        analytics_record_mock: Mock,
    ):
        self.login_as(user=self.owner, superuser=False)

        with tempfile.TemporaryDirectory() as tmp_dir:
            (_, tmp_pub_key_path) = self.tmp_keys(tmp_dir)
            with open(FRESH_INSTALL_PATH, "rb") as f:
                data = orjson.loads(f.read())
                with open(tmp_pub_key_path, "rb") as p:
                    response = self.get_success_response(
                        owner=self.owner.username,
                        file=SimpleUploadedFile(
                            "export.tar",
                            create_encrypted_export_tarball(data, LocalFileEncryptor(p)).getvalue(),
                            content_type="application/tar",
                        ),
                        orgs="testing",
                        format="multipart",
                        status_code=201,
                    )

        assert response.data["status"] == Relocation.Status.IN_PROGRESS.name
        assert response.data["step"] == Relocation.Step.UPLOADING.name
        assert response.data["scheduledPauseAtStep"] == Relocation.Step.IMPORTING.name

        assert uploading_start_mock.call_count == 1
        uploading_start_mock.assert_called_with(args=[UUID(response.data["uuid"]), None, None])

        assert analytics_record_mock.call_count == 1
        analytics_record_mock.assert_called_with(
            "relocation.created",
            creator_id=int(response.data["creator"]["id"]),
            owner_id=int(response.data["owner"]["id"]),
            uuid=response.data["uuid"],
        )

        assert relocation_link_promo_code_signal_mock.call_count == 1
        relocation_link_promo_code_signal_mock.assert_called_with(
            relocation_uuid=UUID(response.data["uuid"]),
            promo_code=None,
            sender=RelocationIndexEndpoint,
        )

    @override_options(
        {
            "relocation.enabled": True,
            "relocation.daily-limit.small": 1,
            "relocation.autopause.saas-to-saas": "IMPORTING",
        }
    )
    @patch("sentry.relocation.tasks.uploading_start.apply_async")
    def test_good_with_untriggered_autopause_option(
        self,
        uploading_start_mock: Mock,
        relocation_link_promo_code_signal_mock: Mock,
        analytics_record_mock: Mock,
    ):
        self.login_as(user=self.owner, superuser=False)

        with tempfile.TemporaryDirectory() as tmp_dir:
            (_, tmp_pub_key_path) = self.tmp_keys(tmp_dir)
            with open(FRESH_INSTALL_PATH, "rb") as f:
                data = orjson.loads(f.read())
                with open(tmp_pub_key_path, "rb") as p:
                    response = self.get_success_response(
                        owner=self.owner.username,
                        file=SimpleUploadedFile(
                            "export.tar",
                            create_encrypted_export_tarball(data, LocalFileEncryptor(p)).getvalue(),
                            content_type="application/tar",
                        ),
                        orgs="testing",
                        format="multipart",
                        status_code=201,
                    )

        assert response.data["status"] == Relocation.Status.IN_PROGRESS.name
        assert response.data["step"] == Relocation.Step.UPLOADING.name
        assert response.data["scheduledPauseAtStep"] is None

    @override_options(
        {
            "relocation.enabled": True,
            "relocation.daily-limit.small": 1,
            "relocation.autopause.self-hosted": "DOESNOTEXIST",
        }
    )
    @patch("sentry.relocation.tasks.uploading_start.apply_async")
    def test_good_with_invalid_autopause_option(
        self,
        uploading_start_mock: Mock,
        relocation_link_promo_code_signal_mock: Mock,
        analytics_record_mock: Mock,
    ):
        self.login_as(user=self.owner, superuser=False)

        with tempfile.TemporaryDirectory() as tmp_dir:
            (_, tmp_pub_key_path) = self.tmp_keys(tmp_dir)
            with open(FRESH_INSTALL_PATH, "rb") as f:
                data = orjson.loads(f.read())
                with open(tmp_pub_key_path, "rb") as p:
                    response = self.get_success_response(
                        owner=self.owner.username,
                        file=SimpleUploadedFile(
                            "export.tar",
                            create_encrypted_export_tarball(data, LocalFileEncryptor(p)).getvalue(),
                            content_type="application/tar",
                        ),
                        orgs="testing",
                        format="multipart",
                        status_code=201,
                    )

        assert response.data["status"] == Relocation.Status.IN_PROGRESS.name
        assert response.data["step"] == Relocation.Step.UPLOADING.name
        assert response.data["scheduledPauseAtStep"] is None

        assert uploading_start_mock.call_count == 1
        uploading_start_mock.assert_called_with(args=[UUID(response.data["uuid"]), None, None])

        assert analytics_record_mock.call_count == 1
        analytics_record_mock.assert_called_with(
            "relocation.created",
            creator_id=int(response.data["creator"]["id"]),
            owner_id=int(response.data["owner"]["id"]),
            uuid=response.data["uuid"],
        )

        assert relocation_link_promo_code_signal_mock.call_count == 1
        relocation_link_promo_code_signal_mock.assert_called_with(
            relocation_uuid=UUID(response.data["uuid"]),
            promo_code=None,
            sender=RelocationIndexEndpoint,
        )

    @override_options(
        {"relocation.enabled": False, "relocation.daily-limit.small": 1, "staff.ga-rollout": True}
    )
    @patch("sentry.relocation.tasks.uploading_start.apply_async")
    def test_good_staff_when_feature_disabled(
        self,
        uploading_start_mock: Mock,
        relocation_link_promo_code_signal_mock: Mock,
        analytics_record_mock: Mock,
    ):
        self.login_as(user=self.staff_user, staff=True)
        relocation_count = Relocation.objects.count()
        relocation_file_count = RelocationFile.objects.count()

        with tempfile.TemporaryDirectory() as tmp_dir:
            (_, tmp_pub_key_path) = self.tmp_keys(tmp_dir)
            with open(FRESH_INSTALL_PATH, "rb") as f:
                data = orjson.loads(f.read())
                with open(tmp_pub_key_path, "rb") as p:
                    response = self.get_success_response(
                        owner=self.owner.username,
                        file=SimpleUploadedFile(
                            "export.tar",
                            create_encrypted_export_tarball(data, LocalFileEncryptor(p)).getvalue(),
                            content_type="application/tar",
                        ),
                        orgs="testing",
                        format="multipart",
                        status_code=201,
                    )

        assert response.data["status"] == Relocation.Status.IN_PROGRESS.name
        assert response.data["step"] == Relocation.Step.UPLOADING.name
        assert response.data["creator"]["id"] == str(self.staff_user.id)
        assert response.data["creator"]["email"] == str(self.staff_user.email)
        assert response.data["creator"]["username"] == str(self.staff_user.username)
        assert response.data["owner"]["id"] == str(self.owner.id)
        assert response.data["owner"]["email"] == str(self.owner.email)
        assert response.data["owner"]["username"] == str(self.owner.username)

        relocation: Relocation = Relocation.objects.get(owner_id=self.owner.id)
        assert str(relocation.uuid) == response.data["uuid"]
        assert relocation.want_org_slugs == ["testing"]
        assert Relocation.objects.count() == relocation_count + 1
        assert RelocationFile.objects.count() == relocation_file_count + 1

        assert uploading_start_mock.call_count == 1
        uploading_start_mock.assert_called_with(args=[UUID(response.data["uuid"]), None, None])

        assert analytics_record_mock.call_count == 1
        analytics_record_mock.assert_called_with(
            "relocation.created",
            creator_id=int(response.data["creator"]["id"]),
            owner_id=int(response.data["owner"]["id"]),
            uuid=response.data["uuid"],
        )

        assert relocation_link_promo_code_signal_mock.call_count == 1
        relocation_link_promo_code_signal_mock.assert_called_with(
            relocation_uuid=UUID(response.data["uuid"]),
            promo_code=None,
            sender=RelocationIndexEndpoint,
        )

    @override_options({"relocation.enabled": False, "relocation.daily-limit.small": 1})
    @patch("sentry.relocation.tasks.uploading_start.apply_async")
    def test_good_superuser_when_feature_disabled(
        self,
        uploading_start_mock: Mock,
        relocation_link_promo_code_signal_mock: Mock,
        analytics_record_mock: Mock,
    ):
        self.login_as(user=self.superuser, superuser=True)
        relocation_count = Relocation.objects.count()
        relocation_file_count = RelocationFile.objects.count()

        with tempfile.TemporaryDirectory() as tmp_dir:
            (_, tmp_pub_key_path) = self.tmp_keys(tmp_dir)
            with open(FRESH_INSTALL_PATH, "rb") as f:
                data = orjson.loads(f.read())
                with open(tmp_pub_key_path, "rb") as p:
                    response = self.get_success_response(
                        owner=self.owner.username,
                        file=SimpleUploadedFile(
                            "export.tar",
                            create_encrypted_export_tarball(data, LocalFileEncryptor(p)).getvalue(),
                            content_type="application/tar",
                        ),
                        orgs="testing",
                        format="multipart",
                        status_code=201,
                    )

        assert response.data["status"] == Relocation.Status.IN_PROGRESS.name
        assert response.data["step"] == Relocation.Step.UPLOADING.name
        assert response.data["creator"]["id"] == str(self.superuser.id)
        assert response.data["creator"]["email"] == str(self.superuser.email)
        assert response.data["creator"]["username"] == str(self.superuser.username)
        assert response.data["owner"]["id"] == str(self.owner.id)
        assert response.data["owner"]["email"] == str(self.owner.email)
        assert response.data["owner"]["username"] == str(self.owner.username)

        relocation: Relocation = Relocation.objects.get(owner_id=self.owner.id)
        assert str(relocation.uuid) == response.data["uuid"]
        assert relocation.want_org_slugs == ["testing"]
        assert Relocation.objects.count() == relocation_count + 1
        assert RelocationFile.objects.count() == relocation_file_count + 1

        assert uploading_start_mock.call_count == 1
        uploading_start_mock.assert_called_with(args=[UUID(response.data["uuid"]), None, None])

        assert analytics_record_mock.call_count == 1
        analytics_record_mock.assert_called_with(
            "relocation.created",
            creator_id=int(response.data["creator"]["id"]),
            owner_id=int(response.data["owner"]["id"]),
            uuid=response.data["uuid"],
        )

        assert relocation_link_promo_code_signal_mock.call_count == 1
        relocation_link_promo_code_signal_mock.assert_called_with(
            relocation_uuid=UUID(response.data["uuid"]),
            promo_code=None,
            sender=RelocationIndexEndpoint,
        )

    def test_bad_without_superuser_when_feature_disabled(
        self, relocation_link_promo_code_signal_mock: Mock, analytics_record_mock: Mock
    ):
        self.login_as(user=self.owner, superuser=False)
        with tempfile.TemporaryDirectory() as tmp_dir:
            (_, tmp_pub_key_path) = self.tmp_keys(tmp_dir)
            with open(FRESH_INSTALL_PATH, "rb") as f:
                data = orjson.loads(f.read())
                with open(tmp_pub_key_path, "rb") as p:
                    response = self.get_error_response(
                        owner=self.owner.username,
                        file=SimpleUploadedFile(
                            "export.tar",
                            create_encrypted_export_tarball(data, LocalFileEncryptor(p)).getvalue(),
                            content_type="application/tar",
                        ),
                        orgs="testing, foo",
                        format="multipart",
                        status_code=403,
                    )

        assert response.data.get("detail") is not None
        assert response.data.get("detail") == ERR_FEATURE_DISABLED

        assert analytics_record_mock.call_count == 0

    def test_bad_expired_superuser_when_feature_disabled(
        self, relocation_link_promo_code_signal_mock: Mock, analytics_record_mock: Mock
    ):
        self.login_as(user=self.owner, superuser=True)
        with tempfile.TemporaryDirectory() as tmp_dir:
            (_, tmp_pub_key_path) = self.tmp_keys(tmp_dir)
            with open(FRESH_INSTALL_PATH, "rb") as f:
                data = orjson.loads(f.read())
                with open(tmp_pub_key_path, "rb") as p:
                    response = self.get_error_response(
                        owner=self.owner.username,
                        file=SimpleUploadedFile(
                            "export.tar",
                            create_encrypted_export_tarball(data, LocalFileEncryptor(p)).getvalue(),
                            content_type="application/tar",
                        ),
                        orgs="testing, foo",
                        format="multipart",
                        status_code=403,
                    )

        assert response.data.get("detail") is not None
        assert response.data.get("detail") == ERR_FEATURE_DISABLED

        assert analytics_record_mock.call_count == 0

        assert relocation_link_promo_code_signal_mock.call_count == 0

    # pytest parametrize does not work in TestCase subclasses, so hack around this
    for org_slugs, expected in [
        ("testing,foo,", ["testing", "foo"]),
        ("testing, foo", ["testing", "foo"]),
        ("testing,\tfoo", ["testing", "foo"]),
        ("testing,\nfoo", ["testing", "foo"]),
    ]:

        @override_options({"relocation.enabled": True, "relocation.daily-limit.small": 1})
        @patch("sentry.relocation.tasks.uploading_start.apply_async")
        def test_good_valid_org_slugs(
            self,
            uploading_start_mock: Mock,
            relocation_link_promo_code_signal_mock: Mock,
            analytics_record_mock: Mock,
            org_slugs=org_slugs,
            expected=expected,
        ):
            self.login_as(user=self.owner, superuser=False)
            relocation_count = Relocation.objects.count()
            relocation_file_count = RelocationFile.objects.count()

            with tempfile.TemporaryDirectory() as tmp_dir:
                (_, tmp_pub_key_path) = self.tmp_keys(tmp_dir)
                with open(FRESH_INSTALL_PATH, "rb") as f:
                    data = orjson.loads(f.read())
                    with open(tmp_pub_key_path, "rb") as p:
                        response = self.get_success_response(
                            owner=self.owner.username,
                            file=SimpleUploadedFile(
                                "export.tar",
                                create_encrypted_export_tarball(
                                    data, LocalFileEncryptor(p)
                                ).getvalue(),
                                content_type="application/tar",
                            ),
                            orgs=org_slugs,
                            format="multipart",
                            status_code=201,
                        )

            assert Relocation.objects.count() == relocation_count + 1
            assert RelocationFile.objects.count() == relocation_file_count + 1
            assert Relocation.objects.get(owner_id=self.owner.id).want_org_slugs == expected
            assert uploading_start_mock.call_count == 1
            uploading_start_mock.assert_called_with(args=[UUID(response.data["uuid"]), None, None])

            assert analytics_record_mock.call_count == 1
            analytics_record_mock.assert_called_with(
                "relocation.created",
                creator_id=int(response.data["creator"]["id"]),
                owner_id=int(response.data["owner"]["id"]),
                uuid=response.data["uuid"],
            )

            assert relocation_link_promo_code_signal_mock.call_count == 1
            relocation_link_promo_code_signal_mock.assert_called_with(
                relocation_uuid=UUID(response.data["uuid"]),
                promo_code=None,
                sender=RelocationIndexEndpoint,
            )

    for org_slugs, invalid_org_slug in [
        (",,", ""),
        ("testing,,foo", ""),
        ("testing\nfoo", "testing\nfoo"),
        ("testing\tfoo", "testing\tfoo"),
    ]:

        @override_options({"relocation.enabled": True, "relocation.daily-limit.small": 1})
        @patch("sentry.relocation.tasks.uploading_start.apply_async")
        def test_bad_invalid_org_slugs(
            self,
            analytics_record_mock: Mock,
            relocation_link_promo_code_signal_mock: Mock,
            uploading_start_mock: Mock,
            org_slugs=org_slugs,
            invalid_org_slug=invalid_org_slug,
        ):
            self.login_as(user=self.owner, superuser=False)
            relocation_count = Relocation.objects.count()
            relocation_file_count = RelocationFile.objects.count()

            with tempfile.TemporaryDirectory() as tmp_dir:
                (_, tmp_pub_key_path) = self.tmp_keys(tmp_dir)
                with open(FRESH_INSTALL_PATH, "rb") as f:
                    data = orjson.loads(f.read())
                    with open(tmp_pub_key_path, "rb") as p:
                        response = self.get_error_response(
                            owner=self.owner.username,
                            file=SimpleUploadedFile(
                                "export.tar",
                                create_encrypted_export_tarball(
                                    data, LocalFileEncryptor(p)
                                ).getvalue(),
                                content_type="application/tar",
                            ),
                            orgs=org_slugs,
                            format="multipart",
                            status_code=400,
                        )

            assert response.data.get("detail") is not None
            assert response.data.get("detail") == ERR_INVALID_ORG_SLUG.substitute(
                org_slug=invalid_org_slug
            )
            assert Relocation.objects.count() == relocation_count
            assert RelocationFile.objects.count() == relocation_file_count
            assert uploading_start_mock.call_count == 0
            assert analytics_record_mock.call_count == 0
            assert relocation_link_promo_code_signal_mock.call_count == 0

    @override_options({"relocation.enabled": True, "relocation.daily-limit.small": 1})
    def test_good_relocation_for_same_owner_already_completed(
        self, relocation_link_promo_code_signal_mock: Mock, analytics_record_mock: Mock
    ):
        self.login_as(user=self.owner, superuser=False)
        Relocation.objects.create(
            creator_id=self.superuser.id,
            owner_id=self.owner.id,
            want_org_slugs=["not-relevant-to-this-test"],
            step=Relocation.Step.COMPLETED.value,
            status=Relocation.Status.FAILURE.value,
        )
        Relocation.objects.create(
            creator_id=self.superuser.id,
            owner_id=self.owner.id,
            want_org_slugs=["not-relevant-to-this-test"],
            step=Relocation.Step.COMPLETED.value,
            status=Relocation.Status.SUCCESS.value,
        )
        relocation_count = Relocation.objects.count()
        relocation_file_count = RelocationFile.objects.count()

        with tempfile.TemporaryDirectory() as tmp_dir:
            (_, tmp_pub_key_path) = self.tmp_keys(tmp_dir)
            with open(FRESH_INSTALL_PATH, "rb") as f:
                data = orjson.loads(f.read())
                with open(tmp_pub_key_path, "rb") as p:
                    response = self.get_success_response(
                        owner=self.owner.username,
                        file=SimpleUploadedFile(
                            "export.tar",
                            create_encrypted_export_tarball(data, LocalFileEncryptor(p)).getvalue(),
                            content_type="application/tar",
                        ),
                        orgs="testing, foo",
                        format="multipart",
                        status_code=201,
                    )

        assert Relocation.objects.count() == relocation_count + 1
        assert RelocationFile.objects.count() == relocation_file_count + 1

        assert analytics_record_mock.call_count == 1
        analytics_record_mock.assert_called_with(
            "relocation.created",
            creator_id=int(response.data["creator"]["id"]),
            owner_id=int(response.data["owner"]["id"]),
            uuid=response.data["uuid"],
        )

        assert relocation_link_promo_code_signal_mock.call_count == 1
        relocation_link_promo_code_signal_mock.assert_called_with(
            relocation_uuid=UUID(response.data["uuid"]),
            promo_code=None,
            sender=RelocationIndexEndpoint,
        )

    @override_options({"relocation.enabled": True, "relocation.daily-limit.small": 1})
    def test_bad_missing_file(
        self, relocation_link_promo_code_signal_mock: Mock, analytics_record_mock: Mock
    ):
        self.login_as(user=self.owner, superuser=False)
        with tempfile.TemporaryDirectory() as tmp_dir:
            (_, tmp_pub_key_path) = self.tmp_keys(tmp_dir)
            response = self.get_error_response(
                owner=self.owner.username, orgs="testing, foo", format="multipart", status_code=400
            )

        assert response.data.get("file") is not None
        assert response.data.get("file")[0].code == "required"

        analytics_record_mock.assert_not_called()

        assert relocation_link_promo_code_signal_mock.call_count == 0

    @override_options({"relocation.enabled": True, "relocation.daily-limit.small": 1})
    def test_bad_missing_orgs(
        self, relocation_link_promo_code_signal_mock: Mock, analytics_record_mock: Mock
    ):
        self.login_as(user=self.owner, superuser=False)
        with tempfile.TemporaryDirectory() as tmp_dir:
            (_, tmp_pub_key_path) = self.tmp_keys(tmp_dir)
            with open(FRESH_INSTALL_PATH, "rb") as f:
                data = orjson.loads(f.read())
                with open(tmp_pub_key_path, "rb") as p:
                    response = self.get_error_response(
                        owner=self.owner.username,
                        file=SimpleUploadedFile(
                            "export.tar",
                            create_encrypted_export_tarball(data, LocalFileEncryptor(p)).getvalue(),
                            content_type="application/tar",
                        ),
                        format="multipart",
                        status_code=400,
                    )

        assert response.data.get("orgs") is not None
        assert response.data.get("orgs")[0].code == "required"

        analytics_record_mock.assert_not_called()

        assert relocation_link_promo_code_signal_mock.call_count == 0

    @override_options({"relocation.enabled": True, "relocation.daily-limit.small": 1})
    def test_bad_missing_owner(
        self, relocation_link_promo_code_signal_mock: Mock, analytics_record_mock: Mock
    ):
        self.login_as(user=self.owner, superuser=False)
        with tempfile.TemporaryDirectory() as tmp_dir:
            (_, tmp_pub_key_path) = self.tmp_keys(tmp_dir)
            with open(FRESH_INSTALL_PATH, "rb") as f:
                data = orjson.loads(f.read())
                with open(tmp_pub_key_path, "rb") as p:
                    response = self.get_error_response(
                        file=SimpleUploadedFile(
                            "export.tar",
                            create_encrypted_export_tarball(data, LocalFileEncryptor(p)).getvalue(),
                            content_type="application/tar",
                        ),
                        orgs="testing, foo",
                        format="multipart",
                        status_code=400,
                    )

        assert response.data.get("owner") is not None
        assert response.data.get("owner")[0].code == "required"

        analytics_record_mock.assert_not_called()

        assert relocation_link_promo_code_signal_mock.call_count == 0

    @override_options(
        {"relocation.enabled": True, "relocation.daily-limit.small": 1, "staff.ga-rollout": True}
    )
    def test_bad_staff_nonexistent_owner(
        self, relocation_link_promo_code_signal_mock: Mock, analytics_record_mock: Mock
    ):
        self.login_as(user=self.staff_user, staff=True)
        with tempfile.TemporaryDirectory() as tmp_dir:
            (_, tmp_pub_key_path) = self.tmp_keys(tmp_dir)
            with open(FRESH_INSTALL_PATH, "rb") as f:
                data = orjson.loads(f.read())
                with open(tmp_pub_key_path, "rb") as p:
                    response = self.get_error_response(
                        owner="doesnotexist",
                        file=SimpleUploadedFile(
                            "export.tar",
                            create_encrypted_export_tarball(data, LocalFileEncryptor(p)).getvalue(),
                            content_type="application/tar",
                        ),
                        orgs="testing, foo",
                        format="multipart",
                        status_code=400,
                    )

        assert response.data.get("detail") is not None
        assert response.data.get("detail") == ERR_OWNER_NOT_FOUND.substitute(
            owner_username="doesnotexist"
        )

        analytics_record_mock.assert_not_called()

        assert relocation_link_promo_code_signal_mock.call_count == 0

    @override_options({"relocation.enabled": True, "relocation.daily-limit.small": 1})
    def test_bad_superuser_nonexistent_owner(
        self, relocation_link_promo_code_signal_mock: Mock, analytics_record_mock: Mock
    ):
        self.login_as(user=self.superuser, superuser=True)
        with tempfile.TemporaryDirectory() as tmp_dir:
            (_, tmp_pub_key_path) = self.tmp_keys(tmp_dir)
            with open(FRESH_INSTALL_PATH, "rb") as f:
                data = orjson.loads(f.read())
                with open(tmp_pub_key_path, "rb") as p:
                    response = self.get_error_response(
                        owner="doesnotexist",
                        file=SimpleUploadedFile(
                            "export.tar",
                            create_encrypted_export_tarball(data, LocalFileEncryptor(p)).getvalue(),
                            content_type="application/tar",
                        ),
                        orgs="testing, foo",
                        format="multipart",
                        status_code=400,
                    )

        assert response.data.get("detail") is not None
        assert response.data.get("detail") == ERR_OWNER_NOT_FOUND.substitute(
            owner_username="doesnotexist"
        )

        analytics_record_mock.assert_not_called()

        assert relocation_link_promo_code_signal_mock.call_count == 0

    @override_options({"relocation.enabled": True, "relocation.daily-limit.small": 1})
    def test_bad_owner_not_self(
        self, relocation_link_promo_code_signal_mock: Mock, analytics_record_mock: Mock
    ):
        self.login_as(user=self.owner, superuser=False)
        with tempfile.TemporaryDirectory() as tmp_dir:
            (_, tmp_pub_key_path) = self.tmp_keys(tmp_dir)
            with open(FRESH_INSTALL_PATH, "rb") as f:
                data = orjson.loads(f.read())
                with open(tmp_pub_key_path, "rb") as p:
                    response = self.get_error_response(
                        owner="other",
                        file=SimpleUploadedFile(
                            "export.tar",
                            create_encrypted_export_tarball(data, LocalFileEncryptor(p)).getvalue(),
                            content_type="application/tar",
                        ),
                        orgs="testing, foo",
                        format="multipart",
                        status_code=400,
                    )

        assert response.data.get("detail") is not None
        assert response.data.get("detail") == ERR_INVALID_OWNER.substitute(creator_username="owner")

        analytics_record_mock.assert_not_called()

        assert relocation_link_promo_code_signal_mock.call_count == 0

    for stat in [
        Relocation.Status.IN_PROGRESS,
        Relocation.Status.PAUSE,
    ]:

        @override_options({"relocation.enabled": True, "relocation.daily-limit.small": 1})
        def test_bad_relocation_for_same_owner_already_active(
            self,
            relocation_link_promo_code_signal_mock: Mock,
            analytics_record_mock: Mock,
            stat=stat,
        ):
            self.login_as(user=self.owner, superuser=False)
            Relocation.objects.create(
                creator_id=self.superuser.id,
                owner_id=self.owner.id,
                want_org_slugs=["not-relevant-to-this-test"],
                status=stat.value,
                step=Relocation.Step.UPLOADING.value,
            )

            with tempfile.TemporaryDirectory() as tmp_dir:
                (_, tmp_pub_key_path) = self.tmp_keys(tmp_dir)
                with open(FRESH_INSTALL_PATH, "rb") as f:
                    data = orjson.loads(f.read())
                    with open(tmp_pub_key_path, "rb") as p:
                        simple_file = SimpleUploadedFile(
                            "export.tar",
                            create_encrypted_export_tarball(data, LocalFileEncryptor(p)).getvalue(),
                            content_type="application/tar",
                        )
                        simple_file.name = None
                        self.get_error_response(
                            owner=self.owner.username,
                            file=simple_file,
                            orgs="testing, foo",
                            format="multipart",
                            status_code=409,
                        )

            analytics_record_mock.assert_not_called()

            assert relocation_link_promo_code_signal_mock.call_count == 0

    @override_options({"relocation.enabled": True, "relocation.daily-limit.small": 1})
    def test_bad_throttle_if_daily_limit_reached(
        self, relocation_link_promo_code_signal_mock: Mock, analytics_record_mock: Mock
    ):
        self.login_as(user=self.owner, superuser=False)
        relocation_count = Relocation.objects.count()
        relocation_file_count = RelocationFile.objects.count()

        with tempfile.TemporaryDirectory() as tmp_dir:
            (_, tmp_pub_key_path) = self.tmp_keys(tmp_dir)
            with open(FRESH_INSTALL_PATH, "rb") as f:
                data = orjson.loads(f.read())
                with open(tmp_pub_key_path, "rb") as p:
                    initial_response = self.get_success_response(
                        owner=self.owner.username,
                        file=SimpleUploadedFile(
                            "export.tar",
                            create_encrypted_export_tarball(data, LocalFileEncryptor(p)).getvalue(),
                            content_type="application/tar",
                        ),
                        orgs="testing, foo",
                        format="multipart",
                        status_code=201,
                    )

                    # Simulate completion of relocation job
                    relocation = Relocation.objects.all()[0]
                    relocation.status = Relocation.Status.SUCCESS.value
                    relocation.save()
                    relocation.refresh_from_db()

                with open(tmp_pub_key_path, "rb") as p:
                    throttled_response = self.get_error_response(
                        owner=self.owner.username,
                        file=SimpleUploadedFile(
                            "export.tar",
                            create_encrypted_export_tarball(data, LocalFileEncryptor(p)).getvalue(),
                            content_type="application/tar",
                        ),
                        orgs="testing, foo",
                        format="multipart",
                        status_code=429,
                    )

        assert initial_response.status_code == status.HTTP_201_CREATED
        assert throttled_response.status_code == status.HTTP_429_TOO_MANY_REQUESTS
        assert throttled_response.data.get("detail") == ERR_THROTTLED_RELOCATION

        assert Relocation.objects.count() == relocation_count + 1
        assert RelocationFile.objects.count() == relocation_file_count + 1

        assert analytics_record_mock.call_count == 1
        analytics_record_mock.assert_called_with(
            "relocation.created",
            creator_id=int(initial_response.data["creator"]["id"]),
            owner_id=int(initial_response.data["owner"]["id"]),
            uuid=initial_response.data["uuid"],
        )

        assert relocation_link_promo_code_signal_mock.call_count == 1
        relocation_link_promo_code_signal_mock.assert_called_with(
            relocation_uuid=UUID(initial_response.data["uuid"]),
            promo_code=None,
            sender=RelocationIndexEndpoint,
        )

    @override_options(
        {"relocation.enabled": True, "relocation.daily-limit.small": 1, "staff.ga-rollout": True}
    )
    def test_good_no_throttle_for_staff(
        self, relocation_link_promo_code_signal_mock: Mock, analytics_record_mock: Mock
    ):
        self.login_as(user=self.staff_user, staff=True)
        relocation_count = Relocation.objects.count()
        relocation_file_count = RelocationFile.objects.count()

        with tempfile.TemporaryDirectory() as tmp_dir:
            (_, tmp_pub_key_path) = self.tmp_keys(tmp_dir)
            with open(FRESH_INSTALL_PATH, "rb") as f:
                data = orjson.loads(f.read())
                with open(tmp_pub_key_path, "rb") as p:
                    initial_response = self.get_success_response(
                        owner=self.owner.username,
                        file=SimpleUploadedFile(
                            "export.tar",
                            create_encrypted_export_tarball(data, LocalFileEncryptor(p)).getvalue(),
                            content_type="application/tar",
                        ),
                        orgs="testing, foo",
                        format="multipart",
                        status_code=201,
                    )

                    # Simulate completion of relocation job
                    relocation = Relocation.objects.all()[0]
                    relocation.status = Relocation.Status.SUCCESS.value
                    relocation.save()
                    relocation.refresh_from_db()

                with open(tmp_pub_key_path, "rb") as p:
                    unthrottled_response = self.get_success_response(
                        owner=self.owner.username,
                        file=SimpleUploadedFile(
                            "export.tar",
                            create_encrypted_export_tarball(data, LocalFileEncryptor(p)).getvalue(),
                            content_type="application/tar",
                        ),
                        orgs="testing, foo",
                        format="multipart",
                        status_code=201,
                    )

        assert initial_response.status_code == status.HTTP_201_CREATED
        assert unthrottled_response.status_code == status.HTTP_201_CREATED
        assert Relocation.objects.count() == relocation_count + 2
        assert RelocationFile.objects.count() == relocation_file_count + 2

        assert analytics_record_mock.call_count == 2
        analytics_record_mock.assert_has_calls(
            [
                call(
                    "relocation.created",
                    creator_id=int(initial_response.data["creator"]["id"]),
                    owner_id=int(initial_response.data["owner"]["id"]),
                    uuid=initial_response.data["uuid"],
                ),
                call(
                    "relocation.created",
                    creator_id=int(unthrottled_response.data["creator"]["id"]),
                    owner_id=int(unthrottled_response.data["owner"]["id"]),
                    uuid=unthrottled_response.data["uuid"],
                ),
            ]
        )

        assert relocation_link_promo_code_signal_mock.call_count == 2
        relocation_link_promo_code_signal_mock.assert_has_calls(
            [
                call(
                    relocation_uuid=UUID(initial_response.data["uuid"]),
                    promo_code=None,
                    sender=RelocationIndexEndpoint,
                ),
                call(
                    relocation_uuid=UUID(unthrottled_response.data["uuid"]),
                    promo_code=None,
                    sender=RelocationIndexEndpoint,
                ),
            ]
        )

    @override_options({"relocation.enabled": True, "relocation.daily-limit.small": 1})
    def test_good_no_throttle_for_superuser(
        self, relocation_link_promo_code_signal_mock: Mock, analytics_record_mock: Mock
    ):
        self.login_as(user=self.superuser, superuser=True)
        relocation_count = Relocation.objects.count()
        relocation_file_count = RelocationFile.objects.count()

        with tempfile.TemporaryDirectory() as tmp_dir:
            (_, tmp_pub_key_path) = self.tmp_keys(tmp_dir)
            with open(FRESH_INSTALL_PATH, "rb") as f:
                data = orjson.loads(f.read())
                with open(tmp_pub_key_path, "rb") as p:
                    initial_response = self.get_success_response(
                        owner=self.owner.username,
                        file=SimpleUploadedFile(
                            "export.tar",
                            create_encrypted_export_tarball(data, LocalFileEncryptor(p)).getvalue(),
                            content_type="application/tar",
                        ),
                        orgs="testing, foo",
                        format="multipart",
                        status_code=201,
                    )

                    # Simulate completion of relocation job
                    relocation = Relocation.objects.all()[0]
                    relocation.status = Relocation.Status.SUCCESS.value
                    relocation.save()
                    relocation.refresh_from_db()

                with open(tmp_pub_key_path, "rb") as p:
                    unthrottled_response = self.get_success_response(
                        owner=self.owner.username,
                        file=SimpleUploadedFile(
                            "export.tar",
                            create_encrypted_export_tarball(data, LocalFileEncryptor(p)).getvalue(),
                            content_type="application/tar",
                        ),
                        orgs="testing, foo",
                        format="multipart",
                        status_code=201,
                    )

        assert initial_response.status_code == status.HTTP_201_CREATED
        assert unthrottled_response.status_code == status.HTTP_201_CREATED
        assert Relocation.objects.count() == relocation_count + 2
        assert RelocationFile.objects.count() == relocation_file_count + 2

        assert analytics_record_mock.call_count == 2
        analytics_record_mock.assert_has_calls(
            [
                call(
                    "relocation.created",
                    creator_id=int(initial_response.data["creator"]["id"]),
                    owner_id=int(initial_response.data["owner"]["id"]),
                    uuid=initial_response.data["uuid"],
                ),
                call(
                    "relocation.created",
                    creator_id=int(unthrottled_response.data["creator"]["id"]),
                    owner_id=int(unthrottled_response.data["owner"]["id"]),
                    uuid=unthrottled_response.data["uuid"],
                ),
            ]
        )

        assert relocation_link_promo_code_signal_mock.call_count == 2
        relocation_link_promo_code_signal_mock.assert_has_calls(
            [
                call(
                    relocation_uuid=UUID(initial_response.data["uuid"]),
                    promo_code=None,
                    sender=RelocationIndexEndpoint,
                ),
                call(
                    relocation_uuid=UUID(unthrottled_response.data["uuid"]),
                    promo_code=None,
                    sender=RelocationIndexEndpoint,
                ),
            ]
        )

    @override_options(
        {
            "relocation.enabled": True,
            "relocation.daily-limit.small": 1,
            "relocation.daily-limit.medium": 1,
        }
    )
    def test_good_no_throttle_different_bucket_relocations(
        self, relocation_link_promo_code_signal_mock: Mock, analytics_record_mock: Mock
    ):
        self.login_as(user=self.owner, superuser=False)
        relocation_count = Relocation.objects.count()
        relocation_file_count = RelocationFile.objects.count()

        with tempfile.TemporaryDirectory() as tmp_dir:
            (_, tmp_pub_key_path) = self.tmp_keys(tmp_dir)
            with open(FRESH_INSTALL_PATH, "rb") as f:
                data = orjson.loads(f.read())
                with open(tmp_pub_key_path, "rb") as p:
                    initial_response = self.get_success_response(
                        owner=self.owner.username,
                        file=SimpleUploadedFile(
                            "export.tar",
                            create_encrypted_export_tarball(data, LocalFileEncryptor(p)).getvalue(),
                            content_type="application/tar",
                        ),
                        orgs="testing, foo",
                        format="multipart",
                        status_code=201,
                    )

                    # Simulate completion of relocation job
                    relocation = Relocation.objects.all()[0]
                    relocation.status = Relocation.Status.SUCCESS.value
                    relocation.save()
                    relocation.refresh_from_db()

                with open(tmp_pub_key_path, "rb") as p:
                    unthrottled_response = self.get_success_response(
                        owner=self.owner.username,
                        file=SimpleUploadedFile(
                            "export.tar",
                            create_encrypted_export_tarball(data, LocalFileEncryptor(p)).getvalue()
                            * 1000,
                            content_type="application/tar",
                        ),
                        orgs="testing, foo",
                        format="multipart",
                        status_code=201,
                    )

        assert initial_response.status_code == status.HTTP_201_CREATED
        assert unthrottled_response.status_code == status.HTTP_201_CREATED
        assert Relocation.objects.count() == relocation_count + 2
        assert RelocationFile.objects.count() == relocation_file_count + 2

        assert analytics_record_mock.call_count == 2
        analytics_record_mock.assert_has_calls(
            [
                call(
                    "relocation.created",
                    creator_id=int(initial_response.data["creator"]["id"]),
                    owner_id=int(initial_response.data["owner"]["id"]),
                    uuid=initial_response.data["uuid"],
                ),
                call(
                    "relocation.created",
                    creator_id=int(unthrottled_response.data["creator"]["id"]),
                    owner_id=int(unthrottled_response.data["owner"]["id"]),
                    uuid=unthrottled_response.data["uuid"],
                ),
            ]
        )

        assert relocation_link_promo_code_signal_mock.call_count == 2
        relocation_link_promo_code_signal_mock.assert_has_calls(
            [
                call(
                    relocation_uuid=UUID(initial_response.data["uuid"]),
                    promo_code=None,
                    sender=RelocationIndexEndpoint,
                ),
                call(
                    relocation_uuid=UUID(unthrottled_response.data["uuid"]),
                    promo_code=None,
                    sender=RelocationIndexEndpoint,
                ),
            ]
        )

    @override_options({"relocation.enabled": True, "relocation.daily-limit.small": 1})
    def test_good_no_throttle_relocation_over_multiple_days(
        self, relocation_link_promo_code_signal_mock: Mock, analytics_record_mock: Mock
    ):
        self.login_as(user=self.owner, superuser=False)
        relocation_count = Relocation.objects.count()
        relocation_file_count = RelocationFile.objects.count()

        with tempfile.TemporaryDirectory() as tmp_dir:
            (_, tmp_pub_key_path) = self.tmp_keys(tmp_dir)
            with open(FRESH_INSTALL_PATH) as f, freeze_time("2023-11-28 00:00:00") as frozen_time:
                data = orjson.loads(f.read())
                with open(tmp_pub_key_path, "rb") as p:
                    initial_response = self.get_success_response(
                        owner=self.owner.username,
                        file=SimpleUploadedFile(
                            "export.tar",
                            create_encrypted_export_tarball(data, LocalFileEncryptor(p)).getvalue(),
                            content_type="application/tar",
                        ),
                        orgs="testing, foo",
                        format="multipart",
                        status_code=201,
                    )

                    # Simulate completion of relocation job
                    relocation = Relocation.objects.all()[0]
                    relocation.status = Relocation.Status.SUCCESS.value
                    relocation.save()
                    relocation.refresh_from_db()

                frozen_time.shift(timedelta(days=1, minutes=1))

                # Re-login since session has expired
                self.login_as(user=self.owner, superuser=False)
                with open(tmp_pub_key_path, "rb") as p:
                    unthrottled_response = self.get_success_response(
                        owner=self.owner.username,
                        file=SimpleUploadedFile(
                            "export.tar",
                            create_encrypted_export_tarball(data, LocalFileEncryptor(p)).getvalue(),
                            content_type="application/tar",
                        ),
                        orgs="testing, foo",
                        format="multipart",
                        status_code=201,
                    )

        assert initial_response.status_code == status.HTTP_201_CREATED
        assert unthrottled_response.status_code == status.HTTP_201_CREATED
        assert Relocation.objects.count() == relocation_count + 2
        assert RelocationFile.objects.count() == relocation_file_count + 2

        assert analytics_record_mock.call_count == 2

        analytics_record_mock.assert_has_calls(
            [
                call(
                    "relocation.created",
                    creator_id=int(initial_response.data["creator"]["id"]),
                    owner_id=int(initial_response.data["owner"]["id"]),
                    uuid=initial_response.data["uuid"],
                ),
                call(
                    "relocation.created",
                    creator_id=int(unthrottled_response.data["creator"]["id"]),
                    owner_id=int(unthrottled_response.data["owner"]["id"]),
                    uuid=unthrottled_response.data["uuid"],
                ),
            ]
        )

        assert relocation_link_promo_code_signal_mock.call_count == 2
        relocation_link_promo_code_signal_mock.assert_has_calls(
            [
                call(
                    relocation_uuid=UUID(initial_response.data["uuid"]),
                    promo_code=None,
                    sender=RelocationIndexEndpoint,
                ),
                call(
                    relocation_uuid=UUID(unthrottled_response.data["uuid"]),
                    promo_code=None,
                    sender=RelocationIndexEndpoint,
                ),
            ]
        )

    @override_options({"relocation.enabled": True, "relocation.daily-limit.small": 1})
    def test_bad_no_auth(
        self, relocation_link_promo_code_signal_mock: Mock, analytics_record_mock: Mock
    ):
        relocation_count = Relocation.objects.count()
        relocation_file_count = RelocationFile.objects.count()

        with tempfile.TemporaryDirectory() as tmp_dir:
            (_, tmp_pub_key_path) = self.tmp_keys(tmp_dir)
            with open(FRESH_INSTALL_PATH, "rb") as f:
                data = orjson.loads(f.read())
                with open(tmp_pub_key_path, "rb") as p:
                    self.get_error_response(
                        owner=self.owner.username,
                        file=SimpleUploadedFile(
                            "export.tar",
                            create_encrypted_export_tarball(data, LocalFileEncryptor(p)).getvalue(),
                            content_type="application/tar",
                        ),
                        orgs=["testing", "foo"],
                        format="multipart",
                        status_code=401,
                    )

        assert Relocation.objects.count() == relocation_count
        assert RelocationFile.objects.count() == relocation_file_count

        analytics_record_mock.assert_not_called()

        assert relocation_link_promo_code_signal_mock.call_count == 0
