from datetime import datetime, timezone
from io import BytesIO, StringIO
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
from unittest.mock import patch
from uuid import uuid4

from google_crc32c import value as crc32c

from sentry.backup.crypto import (
    LocalFileDecryptor,
    LocalFileEncryptor,
    create_encrypted_export_tarball,
    unwrap_encrypted_export_tarball,
)
from sentry.models.files.utils import get_relocation_storage
from sentry.relocation.api.endpoints.artifacts.index import ERR_NEED_RELOCATION_ADMIN
from sentry.relocation.models.relocation import Relocation
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.backups import FakeKeyManagementServiceClient, generate_rsa_key_pair
from sentry.testutils.helpers.options import override_options
from sentry.utils.relocation import OrderedTask

TEST_DATE_ADDED = datetime(2023, 1, 23, 1, 23, 45, tzinfo=timezone.utc)
RELOCATION_ADMIN_PERMISSION = "relocation.admin"


class GetRelocationArtifactDetailsTest(APITestCase):
    endpoint = "sentry-api-0-relocations-artifacts-details"
    method = "GET"

    def setUp(self):
        super().setUp()
        self.owner = self.create_user(email="owner@example.com", is_superuser=False, is_staff=False)
        self.superuser = self.create_user(is_superuser=True)
        self.staff_user = self.create_user(is_staff=True)
        self.relocation: Relocation = Relocation.objects.create(
            date_added=TEST_DATE_ADDED,
            creator_id=self.owner.id,
            owner_id=self.owner.id,
            status=Relocation.Status.PAUSE.value,
            step=Relocation.Step.PREPROCESSING.value,
            want_org_slugs=["foo"],
            want_usernames=["alice", "bob"],
            latest_notified=Relocation.EmailKind.STARTED.value,
            latest_task=OrderedTask.PREPROCESSING_SCAN.name,
            latest_task_attempts=1,
        )


class GetRelocationArtifactDetailsGoodTest(GetRelocationArtifactDetailsTest):
    def setUp(self):
        super().setUp()
        dir = f"runs/{self.relocation.uuid}"
        self.relocation_storage = get_relocation_storage()

        # These files are unencrypted, so just save the file name as the content for testing
        # purposes.
        self.relocation_storage.save(
            f"{dir}/somedir/file.json", StringIO(f'"{dir}/somedir/file.json"')
        )

        # `.tar` files should be encrypted.
        with TemporaryDirectory() as tmp_dir:
            (priv_key_pem, pub_key_pem) = generate_rsa_key_pair()
            tmp_priv_key_path = Path(tmp_dir).joinpath("key")
            self.priv_key_pem = priv_key_pem
            with open(tmp_priv_key_path, "wb") as f:
                f.write(priv_key_pem)

            tmp_pub_key_path = Path(tmp_dir).joinpath("key.pub")
            self.pub_key_pem = pub_key_pem
            with open(tmp_pub_key_path, "wb") as f:
                f.write(pub_key_pem)

            with open(tmp_pub_key_path, "rb") as p:
                self.tarball = create_encrypted_export_tarball(
                    f"{dir}/encrypted/file.tar", LocalFileEncryptor(p)
                ).getvalue()
                self.relocation_storage.save(f"{dir}/encrypted/file.tar", BytesIO(self.tarball))

    def mock_kms_client(self, fake_kms_client: FakeKeyManagementServiceClient):
        fake_kms_client.asymmetric_decrypt.call_count = 0
        fake_kms_client.get_public_key.call_count = 0

        unwrapped = unwrap_encrypted_export_tarball(BytesIO(self.tarball))
        plaintext_dek = LocalFileDecryptor.from_bytes(
            self.priv_key_pem
        ).decrypt_data_encryption_key(unwrapped)

        fake_kms_client.asymmetric_decrypt.return_value = SimpleNamespace(
            plaintext=plaintext_dek,
            plaintext_crc32c=crc32c(plaintext_dek),
        )
        fake_kms_client.asymmetric_decrypt.side_effect = None

        fake_kms_client.get_public_key.return_value = SimpleNamespace(
            pem=self.pub_key_pem.decode("utf-8")
        )
        fake_kms_client.get_public_key.side_effect = None

    @patch(
        "sentry.backup.crypto.KeyManagementServiceClient",
        new_callable=lambda: FakeKeyManagementServiceClient,
    )
    def test_good_unencrypted_with_superuser(
        self, fake_kms_client: FakeKeyManagementServiceClient
    ) -> None:
        self.mock_kms_client(fake_kms_client)
        self.add_user_permission(self.superuser, RELOCATION_ADMIN_PERMISSION)
        self.login_as(user=self.superuser, superuser=True)
        response = self.get_success_response(str(self.relocation.uuid), "somedir", "file.json")

        assert fake_kms_client.asymmetric_decrypt.call_count == 0
        assert (
            response.data["contents"] == f'"runs/{self.relocation.uuid}/somedir/file.json"'.encode()
        )

    @patch(
        "sentry.backup.crypto.KeyManagementServiceClient",
        new_callable=lambda: FakeKeyManagementServiceClient,
    )
    def test_good_encrypted_with_superuser(
        self, fake_kms_client: FakeKeyManagementServiceClient
    ) -> None:
        self.mock_kms_client(fake_kms_client)
        self.add_user_permission(self.superuser, RELOCATION_ADMIN_PERMISSION)
        self.login_as(user=self.superuser, superuser=True)
        response = self.get_success_response(str(self.relocation.uuid), "encrypted", "file.tar")

        assert fake_kms_client.asymmetric_decrypt.call_count == 1
        assert str(response.data["contents"]) == f'"runs/{self.relocation.uuid}/encrypted/file.tar"'

    @override_options({"staff.ga-rollout": True})
    @patch(
        "sentry.backup.crypto.KeyManagementServiceClient",
        new_callable=lambda: FakeKeyManagementServiceClient,
    )
    def test_good_unencrypted_with_staff(
        self, fake_kms_client: FakeKeyManagementServiceClient
    ) -> None:
        self.mock_kms_client(fake_kms_client)
        self.add_user_permission(self.staff_user, RELOCATION_ADMIN_PERMISSION)
        self.login_as(user=self.staff_user, staff=True)
        response = self.get_success_response(str(self.relocation.uuid), "somedir", "file.json")

        assert fake_kms_client.asymmetric_decrypt.call_count == 0
        assert (
            response.data["contents"] == f'"runs/{self.relocation.uuid}/somedir/file.json"'.encode()
        )

    @override_options({"staff.ga-rollout": True})
    @patch(
        "sentry.backup.crypto.KeyManagementServiceClient",
        new_callable=lambda: FakeKeyManagementServiceClient,
    )
    def test_good_encrypted_with_staff(
        self, fake_kms_client: FakeKeyManagementServiceClient
    ) -> None:
        self.mock_kms_client(fake_kms_client)
        self.add_user_permission(self.staff_user, RELOCATION_ADMIN_PERMISSION)
        self.login_as(user=self.staff_user, staff=True)
        response = self.get_success_response(str(self.relocation.uuid), "encrypted", "file.tar")

        assert fake_kms_client.asymmetric_decrypt.call_count == 1
        assert str(response.data["contents"]) == f'"runs/{self.relocation.uuid}/encrypted/file.tar"'


class GetRelocationArtifactDetailsBadTest(GetRelocationArtifactDetailsTest):
    def setUp(self):
        super().setUp()
        dir = f"runs/{self.relocation.uuid}"
        self.relocation_storage = get_relocation_storage()

        # These files are unencrypted, so just save the file name as the content for testing
        # purposes.
        self.relocation_storage.save(
            f"{dir}/somedir/file.json", StringIO(f'"{dir}/somedir/file.json"')
        )

    @override_options({"staff.ga-rollout": True})
    def test_bad_unprivileged_user(self):
        self.login_as(user=self.owner, superuser=False, staff=False)

        # Ensures we don't reveal existence info to improperly authenticated users.
        does_not_exist_uuid = uuid4().hex
        self.get_error_response(str(does_not_exist_uuid), "somedir", "file.json", status_code=403)

    def test_bad_superuser_disabled(self):
        self.add_user_permission(self.superuser, RELOCATION_ADMIN_PERMISSION)
        self.login_as(user=self.superuser, superuser=False)

        # Ensures we don't reveal existence info to improperly authenticated users.
        does_not_exist_uuid = uuid4().hex
        self.get_error_response(str(does_not_exist_uuid), "somedir", "file.json", status_code=403)

    @override_options({"staff.ga-rollout": True})
    def test_bad_staff_disabled(self):
        self.add_user_permission(self.staff_user, RELOCATION_ADMIN_PERMISSION)
        self.login_as(user=self.staff_user, staff=False)

        # Ensures we don't reveal existence info to improperly authenticated users.
        does_not_exist_uuid = uuid4().hex
        self.get_error_response(str(does_not_exist_uuid), "somedir", "file.json", status_code=403)

    def test_bad_has_superuser_but_no_relocation_admin_permission(self):
        self.login_as(user=self.superuser, superuser=True)

        # Ensures we don't reveal existence info to improperly authenticated users.
        does_not_exist_uuid = uuid4().hex
        response = self.get_error_response(
            str(does_not_exist_uuid), "somedir", "file.json", status_code=403
        )

        assert response.data.get("detail") == ERR_NEED_RELOCATION_ADMIN

    @override_options({"staff.ga-rollout": True})
    def test_bad_has_staff_but_no_relocation_admin_permission(self):
        self.login_as(user=self.staff_user, staff=True)

        # Ensures we don't reveal existence info to improperly authenticated users.
        does_not_exist_uuid = uuid4().hex
        response = self.get_error_response(
            str(does_not_exist_uuid), "somedir", "file.json", status_code=403
        )

        assert response.data.get("detail") == ERR_NEED_RELOCATION_ADMIN

    @override_options({"staff.ga-rollout": True})
    def test_bad_relocation_not_found(self):
        self.add_user_permission(self.staff_user, RELOCATION_ADMIN_PERMISSION)
        self.login_as(user=self.staff_user, staff=True)
        does_not_exist_uuid = uuid4().hex
        self.get_error_response(str(does_not_exist_uuid), "somedir", "file.json", status_code=404)

    @override_options({"staff.ga-rollout": True})
    def test_bad_file_not_found(self):
        self.add_user_permission(self.staff_user, RELOCATION_ADMIN_PERMISSION)
        self.login_as(user=self.staff_user, staff=True)
        self.get_error_response(
            str(self.relocation.uuid), "nonexistent", "file.json", status_code=404
        )
