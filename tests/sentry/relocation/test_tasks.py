from datetime import timedelta
from functools import cached_property
from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
from unittest.mock import MagicMock, Mock, patch
from uuid import UUID, uuid4

import pytest
from django.core.files.storage import Storage
from django.test import override_settings
from google.cloud.devtools.cloudbuild_v1 import Build
from google_crc32c import value as crc32c

from sentry.backup.crypto import (
    EncryptorDecryptorPair,
    LocalFileDecryptor,
    LocalFileEncryptor,
    create_encrypted_export_tarball,
    decrypt_encrypted_tarball,
    unwrap_encrypted_export_tarball,
)
from sentry.backup.dependencies import NormalizedModelName, get_model_name
from sentry.backup.exports import export_in_organization_scope
from sentry.backup.helpers import ImportFlags, Printer
from sentry.backup.imports import import_in_organization_scope
from sentry.models.files.file import File
from sentry.models.files.utils import get_relocation_storage
from sentry.models.importchunk import (
    ControlImportChunk,
    ControlImportChunkReplica,
    RegionImportChunk,
)
from sentry.models.organization import Organization, OrganizationStatus
from sentry.models.organizationmember import OrganizationMember
from sentry.relocation.models.relocation import (
    Relocation,
    RelocationFile,
    RelocationValidation,
    RelocationValidationAttempt,
    ValidationStatus,
)
from sentry.relocation.services.relocation_export.service import control_relocation_export_service
from sentry.relocation.tasks import (
    ERR_NOTIFYING_INTERNAL,
    ERR_POSTPROCESSING_INTERNAL,
    ERR_PREPROCESSING_DECRYPTION,
    ERR_PREPROCESSING_INTERNAL,
    ERR_PREPROCESSING_INVALID_JSON,
    ERR_PREPROCESSING_INVALID_ORG_SLUG,
    ERR_PREPROCESSING_INVALID_TARBALL,
    ERR_PREPROCESSING_MISSING_ORGS,
    ERR_PREPROCESSING_NO_USERS,
    ERR_PREPROCESSING_TOO_MANY_ORGS,
    ERR_PREPROCESSING_TOO_MANY_USERS,
    ERR_UPLOADING_CROSS_REGION_TIMEOUT,
    ERR_UPLOADING_FAILED,
    ERR_UPLOADING_NO_SAAS_TO_SAAS_ORG_SLUG,
    ERR_VALIDATING_INTERNAL,
    ERR_VALIDATING_MAX_RUNS,
    MAX_FAST_TASK_ATTEMPTS,
    MAX_FAST_TASK_RETRIES,
    MAX_VALIDATION_POLL_ATTEMPTS,
    MAX_VALIDATION_POLLS,
    completed,
    importing,
    notifying_owner,
    notifying_unhide,
    notifying_users,
    postprocessing,
    preprocessing_baseline_config,
    preprocessing_colliding_users,
    preprocessing_complete,
    preprocessing_scan,
    preprocessing_transfer,
    uploading_complete,
    uploading_start,
    validating_complete,
    validating_poll,
    validating_start,
)
from sentry.relocation.utils import (
    RELOCATION_BLOB_SIZE,
    RELOCATION_FILE_TYPE,
    OrderedTask,
    StorageBackedCheckpointExporter,
)
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase, TransactionTestCase
from sentry.testutils.factories import get_fixture_path
from sentry.testutils.helpers.backups import FakeKeyManagementServiceClient, generate_rsa_key_pair
from sentry.testutils.helpers.task_runner import (
    BurstTaskRunner,
    BurstTaskRunnerRetryError,
    TaskRunner,
)
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import assume_test_silo_mode, create_test_regions, region_silo_test
from sentry.users.models.lostpasswordhash import LostPasswordHash
from sentry.users.models.user import User
from sentry.utils import json

IMPORT_JSON_FILE_PATH = get_fixture_path("backup", "fresh-install.json")

REQUESTING_TEST_REGION = "requesting"
EXPORTING_TEST_REGION = "exporting"
SAAS_TO_SAAS_TEST_REGIONS = create_test_regions(REQUESTING_TEST_REGION, EXPORTING_TEST_REGION)


class FakeCloudBuildClient:
    """
    Fake version of `CloudBuildClient` that removes the two network calls we rely on.
    """

    create_build = MagicMock()
    get_build = MagicMock()


class RelocationTaskTestCase(TestCase):
    def setUp(self):
        super().setUp()

        # Create a collision with the org slug we'll be requesting.
        self.requested_org_slug = "testing"
        self.existing_org_owner = self.create_user(
            email="existing_org_owner@example.com",
            is_superuser=False,
            is_staff=False,
            is_active=True,
        )
        self.existing_org = self.create_organization(
            name=self.requested_org_slug, owner=self.existing_org_owner
        )

        self.owner = self.create_user(
            email="owner@example.com", is_superuser=False, is_staff=False, is_active=True
        )
        self.superuser = self.create_user(
            email="superuser@example.com", is_superuser=True, is_staff=True, is_active=True
        )
        self.login_as(user=self.superuser, superuser=True)
        self.relocation: Relocation = Relocation.objects.create(
            creator_id=self.superuser.id,
            owner_id=self.owner.id,
            want_org_slugs=[self.requested_org_slug],
            step=Relocation.Step.UPLOADING.value,
        )
        self.relocation_file = RelocationFile.objects.create(
            relocation=self.relocation,
            file=self.file,
            kind=RelocationFile.Kind.RAW_USER_DATA.value,
        )
        self.uuid = UUID(str(self.relocation.uuid))

    @cached_property
    def file(self):
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

            with open(IMPORT_JSON_FILE_PATH, "rb") as f:
                data = json.load(f)
                with open(tmp_pub_key_path, "rb") as p:
                    file = File.objects.create(name="export.tar", type=RELOCATION_FILE_TYPE)
                    self.tarball = create_encrypted_export_tarball(
                        data, LocalFileEncryptor(p)
                    ).getvalue()
                    file.putfile(BytesIO(self.tarball))

            return file

    def swap_relocation_file_with_data_from_fixture(
        self, file: File, fixture_name: str, blob_size: int = RELOCATION_BLOB_SIZE
    ) -> None:
        with open(get_fixture_path("backup", fixture_name), "rb") as fp:
            return self.swap_relocation_file(file, BytesIO(fp.read()), blob_size)

    def swap_relocation_file(
        self, file: File, contents: BytesIO, blob_size: int = RELOCATION_BLOB_SIZE
    ) -> None:
        with TemporaryDirectory() as tmp_dir:
            tmp_priv_key_path = Path(tmp_dir).joinpath("key")
            tmp_pub_key_path = Path(tmp_dir).joinpath("key.pub")
            with open(tmp_priv_key_path, "wb") as f:
                f.write(self.priv_key_pem)
            with open(tmp_pub_key_path, "wb") as f:
                f.write(self.pub_key_pem)

            data = json.load(contents)
            with open(tmp_pub_key_path, "rb") as p:
                self.tarball = create_encrypted_export_tarball(
                    data, LocalFileEncryptor(p)
                ).getvalue()
                file.putfile(BytesIO(self.tarball), blob_size=blob_size)

    def mock_kms_client(self, fake_kms_client: FakeKeyManagementServiceClient):
        fake_kms_client.asymmetric_decrypt.call_count = 0
        fake_kms_client.get_public_key.call_count = 0
        if not hasattr(self, "tarball"):
            _ = self.file

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

    def mock_cloudbuild_client(
        self, fake_cloudbuild_client: FakeCloudBuildClient, status: Build.Status
    ):
        fake_cloudbuild_client.create_build.call_count = 0
        fake_cloudbuild_client.get_build.call_count = 0

        fake_cloudbuild_client.create_build.return_value = SimpleNamespace(
            metadata=SimpleNamespace(build=SimpleNamespace(id=uuid4().hex))
        )
        fake_cloudbuild_client.create_build.side_effect = None

        fake_cloudbuild_client.get_build.return_value = SimpleNamespace(status=status)
        fake_cloudbuild_client.get_build.side_effect = None

    def mock_message_builder(self, fake_message_builder: Mock):
        fake_message_builder.return_value.send_async.return_value = Mock()


@patch(
    "sentry.backup.crypto.KeyManagementServiceClient",
    new_callable=lambda: FakeKeyManagementServiceClient,
)
@patch("sentry.utils.relocation.MessageBuilder")
@patch("sentry.relocation.tasks.uploading_complete.apply_async")
@region_silo_test(regions=SAAS_TO_SAAS_TEST_REGIONS)
class UploadingStartTest(RelocationTaskTestCase):
    def setUp(self):
        self.owner = self.create_user(
            email="owner@example.com", is_superuser=False, is_staff=False, is_active=True
        )
        self.superuser = self.create_user(
            email="superuser@example.com", is_superuser=True, is_staff=True, is_active=True
        )
        self.login_as(user=self.superuser, superuser=True)

        with assume_test_silo_mode(SiloMode.REGION, region_name=EXPORTING_TEST_REGION):
            self.requested_org_slug = "testing"
            self.existing_org_owner = self.create_user(
                email="existing_org_owner@example.com",
                is_superuser=False,
                is_staff=False,
                is_active=True,
            )
            self.existing_org = self.create_organization(
                name=self.requested_org_slug, owner=self.existing_org_owner
            )

        with assume_test_silo_mode(SiloMode.REGION, region_name=REQUESTING_TEST_REGION):
            self.relocation: Relocation = Relocation.objects.create(
                creator_id=self.superuser.id,
                owner_id=self.owner.id,
                want_org_slugs=[self.requested_org_slug],
                step=Relocation.Step.UPLOADING.value,
                latest_task=OrderedTask.UPLOADING_START.name,
                provenance=Relocation.Provenance.SAAS_TO_SAAS,
            )
            self.uuid = UUID(str(self.relocation.uuid))

    @override_settings(
        SENTRY_MONOLITH_REGION=REQUESTING_TEST_REGION, SENTRY_REGION=REQUESTING_TEST_REGION
    )
    @patch("sentry.relocation.tasks.cross_region_export_timeout_check.apply_async")
    def test_success_saas_to_saas(
        self,
        cross_region_export_timeout_check_mock: Mock,
        uploading_complete_mock: Mock,
        fake_message_builder: Mock,
        fake_kms_client: FakeKeyManagementServiceClient,
    ):
        self.mock_message_builder(fake_message_builder)
        self.mock_kms_client(fake_kms_client)

        assert not RelocationFile.objects.filter(relocation=self.relocation).exists()
        with assume_test_silo_mode(SiloMode.REGION, region_name=REQUESTING_TEST_REGION):
            uploading_start(self.uuid, EXPORTING_TEST_REGION, self.requested_org_slug)

            assert uploading_complete_mock.call_count == 0
            with outbox_runner():
                pass

        assert uploading_complete_mock.call_count == 1
        assert cross_region_export_timeout_check_mock.call_count == 1
        assert fake_message_builder.call_count == 0
        assert fake_kms_client.get_public_key.call_count > 0
        assert fake_kms_client.asymmetric_decrypt.call_count == 0

        assert RelocationFile.objects.filter(
            relocation=self.relocation,
            kind=RelocationFile.Kind.RAW_USER_DATA.value,
        ).exists()

    @override_settings(
        SENTRY_MONOLITH_REGION=REQUESTING_TEST_REGION, SENTRY_REGION=REQUESTING_TEST_REGION
    )
    @patch("sentry.relocation.tasks.cross_region_export_timeout_check.apply_async")
    def test_success_saas_to_saas_racing(
        self,
        cross_region_export_timeout_check_mock: Mock,
        uploading_complete_mock: Mock,
        fake_message_builder: Mock,
        fake_kms_client: FakeKeyManagementServiceClient,
    ):
        self.mock_message_builder(fake_message_builder)
        self.mock_kms_client(fake_kms_client)

        assert not RelocationFile.objects.filter(relocation=self.relocation).exists()
        with assume_test_silo_mode(SiloMode.REGION, region_name=REQUESTING_TEST_REGION):
            uploading_start(self.uuid, EXPORTING_TEST_REGION, self.requested_org_slug)

            # Create a racing call, due to ex: outbox retry. These must be deduped when
            # receiving the reply back in the requesting region.
            control_relocation_export_service.request_new_export(
                relocation_uuid=str(self.uuid),
                requesting_region_name=REQUESTING_TEST_REGION,
                replying_region_name=EXPORTING_TEST_REGION,
                org_slug=self.requested_org_slug,
                encrypt_with_public_key=fake_kms_client.get_public_key().pem.encode(),
            )

            assert uploading_complete_mock.call_count == 0
            with outbox_runner():
                pass

        assert uploading_complete_mock.call_count == 1
        assert cross_region_export_timeout_check_mock.call_count == 1
        assert fake_message_builder.call_count == 0
        assert fake_kms_client.get_public_key.call_count > 0
        assert fake_kms_client.asymmetric_decrypt.call_count == 0

        assert (
            RelocationFile.objects.filter(
                relocation=self.relocation,
                kind=RelocationFile.Kind.RAW_USER_DATA.value,
            ).count()
            == 1
        )

    @override_settings(
        SENTRY_MONOLITH_REGION=REQUESTING_TEST_REGION, SENTRY_REGION=REQUESTING_TEST_REGION
    )
    @patch("sentry.relocation.tasks.cross_region_export_timeout_check.apply_async")
    def test_outbox_killswitch(
        self,
        cross_region_export_timeout_check_mock: Mock,
        uploading_complete_mock: Mock,
        fake_message_builder: Mock,
        fake_kms_client: FakeKeyManagementServiceClient,
    ):
        self.mock_message_builder(fake_message_builder)
        self.mock_kms_client(fake_kms_client)

        assert not RelocationFile.objects.filter(relocation=self.relocation).exists()
        with (
            self.options({"relocation.outbox-orgslug.killswitch": [self.requested_org_slug]}),
            assume_test_silo_mode(SiloMode.REGION, region_name=REQUESTING_TEST_REGION),
        ):
            uploading_start(self.uuid, EXPORTING_TEST_REGION, self.requested_org_slug)

            # Create a racing call, due to ex: outbox retry. These must be deduped when
            # receiving the reply back in the requesting region.
            control_relocation_export_service.request_new_export(
                relocation_uuid=str(self.uuid),
                requesting_region_name=REQUESTING_TEST_REGION,
                replying_region_name=EXPORTING_TEST_REGION,
                org_slug=self.requested_org_slug,
                encrypt_with_public_key=fake_kms_client.get_public_key().pem.encode(),
            )

            assert uploading_complete_mock.call_count == 0
            with outbox_runner():
                pass

        assert cross_region_export_timeout_check_mock.call_count == 1
        assert fake_message_builder.call_count == 0
        assert fake_kms_client.get_public_key.call_count > 0
        assert fake_kms_client.asymmetric_decrypt.call_count == 0

        # No uploading_complete call, or file created because the killswitch is active
        assert uploading_complete_mock.call_count == 0
        assert (
            RelocationFile.objects.filter(
                relocation=self.relocation,
                kind=RelocationFile.Kind.RAW_USER_DATA.value,
            ).count()
            == 0
        )

    @patch("sentry.relocation.tasks.cross_region_export_timeout_check.apply_async")
    def test_success_self_hosted(
        self,
        cross_region_export_timeout_check_mock: Mock,
        uploading_complete_mock: Mock,
        fake_message_builder: Mock,
        fake_kms_client: FakeKeyManagementServiceClient,
    ):
        self.mock_message_builder(fake_message_builder)
        self.mock_kms_client(fake_kms_client)

        self.relocation.provenance = Relocation.Provenance.SELF_HOSTED
        self.relocation.save()

        assert not RelocationFile.objects.filter(relocation=self.relocation).exists()
        with assume_test_silo_mode(SiloMode.REGION, region_name=REQUESTING_TEST_REGION):
            uploading_start(self.uuid, None, None)

            assert uploading_complete_mock.call_count == 1
            with outbox_runner():
                pass

        assert uploading_complete_mock.call_count == 1
        assert cross_region_export_timeout_check_mock.call_count == 0
        assert fake_message_builder.call_count == 0
        assert fake_kms_client.get_public_key.call_count == 0
        assert fake_kms_client.asymmetric_decrypt.call_count == 0

        assert not RelocationFile.objects.filter(relocation=self.relocation).exists()

    @patch("sentry.relocation.tasks.cross_region_export_timeout_check.apply_async")
    def test_retry_if_attempts_left(
        self,
        cross_region_export_timeout_check_mock: Mock,
        uploading_complete_mock: Mock,
        fake_message_builder: Mock,
        fake_kms_client: FakeKeyManagementServiceClient,
    ):
        self.mock_message_builder(fake_message_builder)
        self.mock_kms_client(fake_kms_client)

        # An exception being raised will trigger a retry in celery.
        with pytest.raises(Exception):
            fake_kms_client.get_public_key.side_effect = Exception("Test")
            with assume_test_silo_mode(SiloMode.REGION, region_name=REQUESTING_TEST_REGION):
                uploading_start(self.uuid, EXPORTING_TEST_REGION, self.requested_org_slug)

        assert uploading_complete_mock.call_count == 0
        assert cross_region_export_timeout_check_mock.call_count == 0
        assert fake_message_builder.call_count == 0
        assert fake_kms_client.get_public_key.call_count == 1
        assert fake_kms_client.asymmetric_decrypt.call_count == 0

        relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.status == Relocation.Status.IN_PROGRESS.value
        assert not relocation.failure_reason

    @patch("sentry.relocation.tasks.cross_region_export_timeout_check.apply_async")
    def test_fail_if_no_attempts_left(
        self,
        cross_region_export_timeout_check_mock: Mock,
        uploading_complete_mock: Mock,
        fake_message_builder: Mock,
        fake_kms_client: FakeKeyManagementServiceClient,
    ):
        self.mock_message_builder(fake_message_builder)
        self.mock_kms_client(fake_kms_client)
        self.relocation.latest_task = OrderedTask.UPLOADING_START.name
        self.relocation.latest_task_attempts = MAX_FAST_TASK_RETRIES
        self.relocation.save()

        with pytest.raises(Exception):
            fake_kms_client.get_public_key.side_effect = Exception("Test")
            with assume_test_silo_mode(SiloMode.REGION, region_name=REQUESTING_TEST_REGION):
                uploading_start(self.uuid, EXPORTING_TEST_REGION, self.requested_org_slug)

        assert fake_message_builder.call_count == 1
        assert fake_message_builder.call_args.kwargs["type"] == "relocation.failed"
        fake_message_builder.return_value.send_async.assert_called_once_with(
            to=[self.owner.email, self.superuser.email]
        )

        assert uploading_complete_mock.call_count == 0
        assert cross_region_export_timeout_check_mock.call_count == 0
        assert fake_kms_client.get_public_key.call_count == 1
        assert fake_kms_client.asymmetric_decrypt.call_count == 0

        relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.status == Relocation.Status.FAILURE.value
        assert relocation.failure_reason == ERR_UPLOADING_FAILED

    @patch("sentry.relocation.tasks.cross_region_export_timeout_check.apply_async")
    def test_fail_no_org_slug_when_saas_to_saas(
        self,
        cross_region_export_timeout_check_mock: Mock,
        uploading_complete_mock: Mock,
        fake_message_builder: Mock,
        fake_kms_client: FakeKeyManagementServiceClient,
    ):
        self.mock_message_builder(fake_message_builder)
        self.mock_kms_client(fake_kms_client)

        assert not RelocationFile.objects.filter(relocation=self.relocation).exists()
        with assume_test_silo_mode(SiloMode.REGION, region_name=REQUESTING_TEST_REGION):
            # Will fail, because we do not supply an `org_slug` argument for a `SAAS_TO_SAAS`
            # relocation.
            uploading_start(self.uuid, EXPORTING_TEST_REGION, None)

            assert uploading_complete_mock.call_count == 0
            with outbox_runner():
                pass

        assert uploading_complete_mock.call_count == 0
        assert cross_region_export_timeout_check_mock.call_count == 0
        assert fake_message_builder.call_count == 1
        assert fake_kms_client.get_public_key.call_count == 0
        assert fake_kms_client.asymmetric_decrypt.call_count == 0

        relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.status == Relocation.Status.FAILURE.value
        assert relocation.latest_notified == Relocation.EmailKind.FAILED.value
        assert relocation.failure_reason == ERR_UPLOADING_NO_SAAS_TO_SAAS_ORG_SLUG
        assert not RelocationFile.objects.filter(relocation=self.relocation).exists()

    # -1 minutes guarantees a timeout, even during synchronous execution.
    @patch("sentry.relocation.tasks.CROSS_REGION_EXPORT_TIMEOUT", timedelta(minutes=-1))
    def test_fail_due_to_timeout(
        self,
        uploading_complete_mock: Mock,
        fake_message_builder: Mock,
        fake_kms_client: FakeKeyManagementServiceClient,
    ):
        self.mock_message_builder(fake_message_builder)
        self.mock_kms_client(fake_kms_client)

        assert not RelocationFile.objects.filter(relocation=self.relocation).exists()
        with (
            TaskRunner(),
            assume_test_silo_mode(SiloMode.REGION, region_name=REQUESTING_TEST_REGION),
        ):
            uploading_start(self.uuid, EXPORTING_TEST_REGION, self.requested_org_slug)

            assert uploading_complete_mock.call_count == 0
            with outbox_runner():
                pass

            # No reply due to server-side timeout.
            assert uploading_complete_mock.call_count == 0

            # Ensure that the relocation has been marked as failed via the timeout handler on the
            # client-side.
            relocation = Relocation.objects.get(uuid=self.uuid)
            assert relocation.status == Relocation.Status.FAILURE.value
            assert relocation.latest_notified == Relocation.EmailKind.FAILED.value
            assert relocation.failure_reason == ERR_UPLOADING_CROSS_REGION_TIMEOUT.substitute(
                delta=timedelta(minutes=-1)
            )
            assert fake_message_builder.call_count == 1
            assert fake_message_builder.call_args.kwargs["type"] == "relocation.failed"
            fake_message_builder.return_value.send_async.assert_called_once_with(
                to=[self.owner.email, self.superuser.email]
            )

        assert fake_kms_client.get_public_key.call_count == 1
        assert fake_kms_client.asymmetric_decrypt.call_count == 0

        assert not RelocationFile.objects.filter(relocation=self.relocation).exists()


@patch("sentry.utils.relocation.MessageBuilder")
@patch("sentry.relocation.tasks.preprocessing_scan.apply_async")
class UploadingCompleteTest(RelocationTaskTestCase):
    def setUp(self):
        super().setUp()
        self.relocation.step = Relocation.Step.UPLOADING.value
        self.relocation.latest_task = OrderedTask.UPLOADING_START.name
        self.relocation.save()

    def test_success(
        self,
        preprocessing_scan_mock: Mock,
        fake_message_builder: Mock,
    ):
        self.mock_message_builder(fake_message_builder)

        uploading_complete(self.uuid)

        assert fake_message_builder.call_count == 0
        assert preprocessing_scan_mock.call_count == 1

    def test_retry_if_attempts_left(
        self,
        preprocessing_scan_mock: Mock,
        fake_message_builder: Mock,
    ):
        RelocationFile.objects.filter(relocation=self.relocation).delete()
        self.mock_message_builder(fake_message_builder)

        # An exception being raised will trigger a retry in celery.
        with pytest.raises(Exception):
            uploading_complete(self.uuid)

        assert fake_message_builder.call_count == 0
        assert preprocessing_scan_mock.call_count == 0

        relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.status == Relocation.Status.IN_PROGRESS.value
        assert not relocation.failure_reason

    def test_fail_if_no_attempts_left(
        self,
        preprocessing_scan_mock: Mock,
        fake_message_builder: Mock,
    ):
        self.relocation.latest_task = OrderedTask.UPLOADING_COMPLETE.name
        self.relocation.latest_task_attempts = MAX_FAST_TASK_RETRIES
        self.relocation.save()
        RelocationFile.objects.filter(relocation=self.relocation).delete()
        self.mock_message_builder(fake_message_builder)

        with pytest.raises(Exception):
            uploading_complete(self.uuid)

        assert fake_message_builder.call_count == 1
        assert fake_message_builder.call_args.kwargs["type"] == "relocation.failed"
        fake_message_builder.return_value.send_async.assert_called_once_with(
            to=[self.owner.email, self.superuser.email]
        )

        assert preprocessing_scan_mock.call_count == 0

        relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.status == Relocation.Status.FAILURE.value
        assert relocation.failure_reason == ERR_UPLOADING_FAILED


@patch(
    "sentry.backup.crypto.KeyManagementServiceClient",
    new_callable=lambda: FakeKeyManagementServiceClient,
)
@patch("sentry.utils.relocation.MessageBuilder")
@patch("sentry.relocation.tasks.preprocessing_transfer.apply_async")
class PreprocessingScanTest(RelocationTaskTestCase):
    def setUp(self):
        super().setUp()
        self.relocation.step = Relocation.Step.UPLOADING.value
        self.relocation.latest_task = OrderedTask.UPLOADING_COMPLETE.name
        self.relocation.save()

    def test_success_admin_assisted_relocation(
        self,
        preprocessing_transfer_mock: Mock,
        fake_message_builder: Mock,
        fake_kms_client: FakeKeyManagementServiceClient,
    ):
        self.mock_message_builder(fake_message_builder)
        self.mock_kms_client(fake_kms_client)

        preprocessing_scan(self.uuid)

        assert fake_kms_client.asymmetric_decrypt.call_count == 1
        assert fake_kms_client.get_public_key.call_count == 0

        assert fake_message_builder.call_count == 1
        assert fake_message_builder.call_args.kwargs["type"] == "relocation.started"
        fake_message_builder.return_value.send_async.assert_called_once_with(
            to=[self.owner.email, self.superuser.email]
        )

        assert preprocessing_transfer_mock.call_count == 1

        relocation: Relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.want_usernames == [
            "admin@example.com",
            "member@example.com",
        ]
        assert relocation.latest_notified == Relocation.EmailKind.STARTED.value

    def test_success_self_service_relocation(
        self,
        preprocessing_transfer_mock: Mock,
        fake_message_builder: Mock,
        fake_kms_client: FakeKeyManagementServiceClient,
    ):
        self.mock_kms_client(fake_kms_client)
        self.relocation.creator_id = self.relocation.owner_id
        self.relocation.save()

        preprocessing_scan(self.uuid)

        assert fake_kms_client.asymmetric_decrypt.call_count == 1
        assert fake_kms_client.get_public_key.call_count == 0

        assert fake_message_builder.call_count == 1
        assert fake_message_builder.call_args.kwargs["type"] == "relocation.started"
        fake_message_builder.return_value.send_async.assert_called_once_with(to=[self.owner.email])

        assert preprocessing_transfer_mock.call_count == 1

        relocation: Relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.want_usernames == [
            "admin@example.com",
            "member@example.com",
        ]
        assert relocation.latest_notified == Relocation.EmailKind.STARTED.value

    def test_pause(
        self,
        preprocessing_transfer_mock: Mock,
        fake_message_builder: Mock,
        fake_kms_client: FakeKeyManagementServiceClient,
    ):
        self.mock_message_builder(fake_message_builder)
        self.mock_kms_client(fake_kms_client)
        self.relocation.scheduled_pause_at_step = Relocation.Step.PREPROCESSING.value
        self.relocation.save()

        preprocessing_scan(self.uuid)

        assert fake_kms_client.asymmetric_decrypt.call_count == 0
        assert fake_kms_client.get_public_key.call_count == 0
        assert fake_message_builder.call_count == 0
        assert preprocessing_transfer_mock.call_count == 0

        relocation: Relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.status == Relocation.Status.PAUSE.value
        assert relocation.step == Relocation.Step.PREPROCESSING.value
        assert relocation.scheduled_pause_at_step is None
        assert relocation.latest_task == OrderedTask.PREPROCESSING_SCAN.name

    def test_retry_if_attempts_left(
        self,
        preprocessing_transfer_mock: Mock,
        fake_message_builder: Mock,
        fake_kms_client: FakeKeyManagementServiceClient,
    ):
        RelocationFile.objects.filter(relocation=self.relocation).delete()
        self.mock_message_builder(fake_message_builder)
        self.mock_kms_client(fake_kms_client)

        # An exception being raised will trigger a retry in celery.
        with pytest.raises(Exception):
            preprocessing_scan(self.uuid)

        assert fake_kms_client.asymmetric_decrypt.call_count == 0
        assert fake_kms_client.get_public_key.call_count == 0
        assert fake_message_builder.call_count == 0
        assert preprocessing_transfer_mock.call_count == 0

        relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.status == Relocation.Status.IN_PROGRESS.value
        assert relocation.latest_notified != Relocation.EmailKind.FAILED.value
        assert not relocation.failure_reason

    def test_fail_if_no_attempts_left(
        self,
        preprocessing_transfer_mock: Mock,
        fake_message_builder: Mock,
        fake_kms_client: FakeKeyManagementServiceClient,
    ):
        self.relocation.latest_task = OrderedTask.PREPROCESSING_SCAN.name
        self.relocation.latest_task_attempts = MAX_FAST_TASK_RETRIES
        self.relocation.save()
        RelocationFile.objects.filter(relocation=self.relocation).delete()
        self.mock_message_builder(fake_message_builder)
        self.mock_kms_client(fake_kms_client)

        with pytest.raises(Exception):
            preprocessing_scan(self.uuid)

        assert fake_kms_client.asymmetric_decrypt.call_count == 0
        assert fake_kms_client.get_public_key.call_count == 0

        assert fake_message_builder.call_count == 1
        assert fake_message_builder.call_args.kwargs["type"] == "relocation.failed"
        fake_message_builder.return_value.send_async.assert_called_once_with(
            to=[self.owner.email, self.superuser.email]
        )

        assert preprocessing_transfer_mock.call_count == 0

        relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.status == Relocation.Status.FAILURE.value
        assert relocation.latest_notified == Relocation.EmailKind.FAILED.value
        assert relocation.failure_reason == ERR_PREPROCESSING_INTERNAL

    def test_fail_invalid_tarball(
        self,
        preprocessing_transfer_mock: Mock,
        fake_message_builder: Mock,
        fake_kms_client: FakeKeyManagementServiceClient,
    ):
        file = RelocationFile.objects.get(relocation=self.relocation).file
        corrupted_tarball_bytes = bytearray(file.getfile().read())[9:]
        file.putfile(BytesIO(bytes(corrupted_tarball_bytes)))
        self.mock_message_builder(fake_message_builder)
        self.mock_kms_client(fake_kms_client)

        preprocessing_scan(self.uuid)

        assert fake_message_builder.call_count == 1
        assert fake_message_builder.call_args.kwargs["type"] == "relocation.failed"
        fake_message_builder.return_value.send_async.assert_called_once_with(
            to=[self.owner.email, self.superuser.email]
        )

        assert preprocessing_transfer_mock.call_count == 0

        relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.status == Relocation.Status.FAILURE.value
        assert relocation.latest_notified == Relocation.EmailKind.FAILED.value
        assert relocation.failure_reason == ERR_PREPROCESSING_INVALID_TARBALL

    def test_fail_decryption_failure(
        self,
        preprocessing_transfer_mock: Mock,
        fake_message_builder: Mock,
        fake_kms_client: FakeKeyManagementServiceClient,
    ):
        # Add invalid 2-octet UTF-8 sequence to the returned plaintext.
        self.mock_message_builder(fake_message_builder)
        self.mock_kms_client(fake_kms_client)
        fake_kms_client.asymmetric_decrypt.return_value.plaintext += b"\xc3\x28"

        # We retry on decryption failures, just to account for flakiness on the KMS server's side.
        # Try this as the last attempt to see the actual error.
        self.relocation.latest_task = OrderedTask.PREPROCESSING_SCAN.name
        self.relocation.latest_task_attempts = MAX_FAST_TASK_RETRIES
        self.relocation.save()

        with pytest.raises(Exception):
            preprocessing_scan(self.uuid)

        assert fake_message_builder.call_count == 1
        assert fake_message_builder.call_args.kwargs["type"] == "relocation.failed"
        fake_message_builder.return_value.send_async.assert_called_once_with(
            to=[self.owner.email, self.superuser.email]
        )

        assert fake_kms_client.asymmetric_decrypt.call_count == 1
        assert preprocessing_transfer_mock.call_count == 0

        relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.status == Relocation.Status.FAILURE.value
        assert relocation.latest_notified == Relocation.EmailKind.FAILED.value
        assert relocation.failure_reason == ERR_PREPROCESSING_DECRYPTION

    def test_fail_invalid_json(
        self,
        preprocessing_transfer_mock: Mock,
        fake_message_builder: Mock,
        fake_kms_client: FakeKeyManagementServiceClient,
    ):
        file = RelocationFile.objects.get(relocation=self.relocation).file
        self.swap_relocation_file_with_data_from_fixture(file, "invalid-user.json")
        self.mock_message_builder(fake_message_builder)
        self.mock_kms_client(fake_kms_client)

        preprocessing_scan(self.uuid)

        assert fake_message_builder.call_count == 1
        assert fake_message_builder.call_args.kwargs["type"] == "relocation.failed"
        fake_message_builder.return_value.send_async.assert_called_once_with(
            to=[self.owner.email, self.superuser.email]
        )

        assert preprocessing_transfer_mock.call_count == 0

        relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.status == Relocation.Status.FAILURE.value
        assert relocation.latest_notified == Relocation.EmailKind.FAILED.value
        assert relocation.failure_reason == ERR_PREPROCESSING_INVALID_JSON

    def test_fail_no_users(
        self,
        preprocessing_transfer_mock: Mock,
        fake_message_builder: Mock,
        fake_kms_client: FakeKeyManagementServiceClient,
    ):
        file = RelocationFile.objects.get(relocation=self.relocation).file
        self.swap_relocation_file_with_data_from_fixture(file, "single-option.json")
        self.mock_message_builder(fake_message_builder)
        self.mock_kms_client(fake_kms_client)

        preprocessing_scan(self.uuid)

        assert fake_message_builder.call_count == 1
        assert fake_message_builder.call_args.kwargs["type"] == "relocation.failed"
        fake_message_builder.return_value.send_async.assert_called_once_with(
            to=[self.owner.email, self.superuser.email]
        )

        assert preprocessing_transfer_mock.call_count == 0

        relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.status == Relocation.Status.FAILURE.value
        assert relocation.latest_notified == Relocation.EmailKind.FAILED.value
        assert relocation.failure_reason == ERR_PREPROCESSING_NO_USERS

    @patch("sentry.relocation.tasks.MAX_USERS_PER_RELOCATION", 1)
    def test_fail_too_many_users(
        self,
        preprocessing_transfer_mock: Mock,
        fake_message_builder: Mock,
        fake_kms_client: FakeKeyManagementServiceClient,
    ):
        self.mock_message_builder(fake_message_builder)
        self.mock_kms_client(fake_kms_client)

        preprocessing_scan(self.uuid)

        assert fake_message_builder.call_count == 1
        assert fake_message_builder.call_args.kwargs["type"] == "relocation.failed"
        fake_message_builder.return_value.send_async.assert_called_once_with(
            to=[self.owner.email, self.superuser.email]
        )

        assert preprocessing_transfer_mock.call_count == 0

        relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.status == Relocation.Status.FAILURE.value
        assert relocation.latest_notified == Relocation.EmailKind.FAILED.value
        assert relocation.failure_reason == ERR_PREPROCESSING_TOO_MANY_USERS.substitute(count=2)

    def test_fail_no_orgs(
        self,
        preprocessing_transfer_mock: Mock,
        fake_message_builder: Mock,
        fake_kms_client: FakeKeyManagementServiceClient,
    ):
        file = RelocationFile.objects.get(relocation=self.relocation).file
        self.swap_relocation_file_with_data_from_fixture(file, "user-with-minimum-privileges.json")
        self.mock_message_builder(fake_message_builder)
        self.mock_kms_client(fake_kms_client)

        preprocessing_scan(self.uuid)

        assert fake_message_builder.call_count == 1
        assert fake_message_builder.call_args.kwargs["type"] == "relocation.failed"
        fake_message_builder.return_value.send_async.assert_called_once_with(
            to=[self.owner.email, self.superuser.email]
        )

        assert preprocessing_transfer_mock.call_count == 0

        relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.status == Relocation.Status.FAILURE.value
        assert relocation.latest_notified == Relocation.EmailKind.FAILED.value
        assert relocation.failure_reason == ERR_PREPROCESSING_MISSING_ORGS.substitute(
            orgs="testing"
        )

    @patch("sentry.relocation.tasks.MAX_ORGS_PER_RELOCATION", 0)
    def test_fail_too_many_orgs(
        self,
        preprocessing_transfer_mock: Mock,
        fake_message_builder: Mock,
        fake_kms_client: FakeKeyManagementServiceClient,
    ):
        self.mock_message_builder(fake_message_builder)
        self.mock_kms_client(fake_kms_client)

        preprocessing_scan(self.uuid)

        assert fake_message_builder.call_count == 1
        assert fake_message_builder.call_args.kwargs["type"] == "relocation.failed"
        fake_message_builder.return_value.send_async.assert_called_once_with(
            to=[self.owner.email, self.superuser.email]
        )

        assert preprocessing_transfer_mock.call_count == 0

        relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.status == Relocation.Status.FAILURE.value
        assert relocation.latest_notified == Relocation.EmailKind.FAILED.value
        assert relocation.failure_reason == ERR_PREPROCESSING_TOO_MANY_ORGS.substitute(count=1)

    def test_fail_missing_orgs(
        self,
        preprocessing_transfer_mock: Mock,
        fake_message_builder: Mock,
        fake_kms_client: FakeKeyManagementServiceClient,
    ):
        orgs = ["does-not-exist"]
        relocation = Relocation.objects.get(uuid=self.uuid)
        relocation.want_org_slugs = orgs
        relocation.save()
        self.mock_message_builder(fake_message_builder)
        self.mock_kms_client(fake_kms_client)

        preprocessing_scan(self.uuid)

        assert fake_message_builder.call_count == 1
        assert fake_message_builder.call_args.kwargs["type"] == "relocation.failed"
        fake_message_builder.return_value.send_async.assert_called_once_with(
            to=[self.owner.email, self.superuser.email]
        )

        assert preprocessing_transfer_mock.call_count == 0

        relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.status == Relocation.Status.FAILURE.value
        assert relocation.latest_notified == Relocation.EmailKind.FAILED.value
        assert relocation.failure_reason == ERR_PREPROCESSING_MISSING_ORGS.substitute(
            orgs=",".join(orgs)
        )

    def test_fail_invalid_org_slug(
        self,
        preprocessing_transfer_mock: Mock,
        fake_message_builder: Mock,
        fake_kms_client: FakeKeyManagementServiceClient,
    ):
        orgs = ["$$##"]
        relocation = Relocation.objects.get(uuid=self.uuid)
        relocation.want_org_slugs = orgs
        relocation.save()
        self.mock_message_builder(fake_message_builder)
        self.mock_kms_client(fake_kms_client)

        preprocessing_scan(self.uuid)

        assert fake_message_builder.call_count == 1
        assert fake_message_builder.call_args.kwargs["type"] == "relocation.failed"
        fake_message_builder.return_value.send_async.assert_called_once_with(
            to=[self.owner.email, self.superuser.email]
        )

        assert preprocessing_transfer_mock.call_count == 0

        relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.status == Relocation.Status.FAILURE.value
        assert relocation.latest_notified == Relocation.EmailKind.FAILED.value
        assert relocation.failure_reason == ERR_PREPROCESSING_INVALID_ORG_SLUG.substitute(
            slug="$$##"
        )


@patch("sentry.utils.relocation.MessageBuilder")
@patch("sentry.relocation.tasks.preprocessing_baseline_config.apply_async")
class PreprocessingTransferTest(RelocationTaskTestCase):
    def setUp(self):
        super().setUp()
        self.relocation.step = Relocation.Step.PREPROCESSING.value
        self.relocation.latest_task = OrderedTask.PREPROCESSING_SCAN.name
        self.relocation.want_usernames = ["importing"]
        self.relocation.save()
        self.create_user("importing")
        self.relocation_storage = get_relocation_storage()

    def test_retry_if_attempts_left(
        self,
        preprocessing_baseline_config_mock: Mock,
        fake_message_builder: Mock,
    ):
        RelocationFile.objects.filter(relocation=self.relocation).delete()
        self.mock_message_builder(fake_message_builder)

        # An exception being raised will trigger a retry in celery.
        with pytest.raises(Exception):
            preprocessing_transfer(self.uuid)

        assert fake_message_builder.call_count == 0
        assert preprocessing_baseline_config_mock.call_count == 0

        relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.status == Relocation.Status.IN_PROGRESS.value
        assert relocation.latest_notified != Relocation.EmailKind.FAILED.value
        assert not relocation.failure_reason

    def test_fail_if_no_attempts_left(
        self,
        preprocessing_baseline_config_mock: Mock,
        fake_message_builder: Mock,
    ):
        self.relocation.latest_task = OrderedTask.PREPROCESSING_TRANSFER.name
        self.relocation.latest_task_attempts = MAX_FAST_TASK_RETRIES
        self.relocation.save()
        RelocationFile.objects.filter(relocation=self.relocation).delete()
        self.mock_message_builder(fake_message_builder)

        with pytest.raises(Exception):
            preprocessing_transfer(self.uuid)

        assert fake_message_builder.call_count == 1
        assert fake_message_builder.call_args.kwargs["type"] == "relocation.failed"
        fake_message_builder.return_value.send_async.assert_called_once_with(
            to=[self.owner.email, self.superuser.email]
        )

        assert preprocessing_baseline_config_mock.call_count == 0

        relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.status == Relocation.Status.FAILURE.value
        assert relocation.latest_notified == Relocation.EmailKind.FAILED.value
        assert relocation.failure_reason == ERR_PREPROCESSING_INTERNAL


@patch(
    "sentry.backup.crypto.KeyManagementServiceClient",
    new_callable=lambda: FakeKeyManagementServiceClient,
)
@patch("sentry.utils.relocation.MessageBuilder")
@patch("sentry.relocation.tasks.preprocessing_colliding_users.apply_async")
class PreprocessingBaselineConfigTest(RelocationTaskTestCase):
    def setUp(self):
        super().setUp()
        self.relocation.step = Relocation.Step.PREPROCESSING.value
        self.relocation.latest_task = OrderedTask.PREPROCESSING_TRANSFER.name
        self.relocation.save()
        self.relocation_storage = get_relocation_storage()

    def test_success(
        self,
        preprocessing_colliding_users_mock: Mock,
        fake_message_builder: Mock,
        fake_kms_client: FakeKeyManagementServiceClient,
    ):
        self.mock_message_builder(fake_message_builder)
        self.mock_kms_client(fake_kms_client)

        preprocessing_baseline_config(self.uuid)

        assert fake_kms_client.asymmetric_decrypt.call_count == 0
        assert fake_kms_client.get_public_key.call_count == 1
        assert fake_message_builder.call_count == 0
        assert preprocessing_colliding_users_mock.call_count == 1

        (_, files) = self.relocation_storage.listdir(f"runs/{self.uuid}/in")
        assert len(files) == 1
        assert "baseline-config.tar" in files

        with self.relocation_storage.open(f"runs/{self.uuid}/in/baseline-config.tar") as fp:
            json_models = json.loads(
                decrypt_encrypted_tarball(fp, LocalFileDecryptor.from_bytes(self.priv_key_pem))
            )
        assert len(json_models) > 0

        # Only user `superuser` is an admin, so only they should be exported.
        for json_model in json_models:
            if NormalizedModelName(json_model["model"]) == get_model_name(User):
                assert json_model["fields"]["username"] in "superuser@example.com"

    def test_retry_if_attempts_left(
        self,
        preprocessing_colliding_users_mock: Mock,
        fake_message_builder: Mock,
        fake_kms_client: FakeKeyManagementServiceClient,
    ):
        self.mock_message_builder(fake_message_builder)
        self.mock_kms_client(fake_kms_client)
        RelocationFile.objects.filter(relocation=self.relocation).delete()

        # An exception being raised will trigger a retry in celery.
        with pytest.raises(Exception):
            fake_kms_client.get_public_key.side_effect = Exception("Test")

            preprocessing_baseline_config(self.uuid)

        assert fake_kms_client.asymmetric_decrypt.call_count == 0
        assert fake_kms_client.get_public_key.call_count == 1
        assert fake_message_builder.call_count == 0
        assert preprocessing_colliding_users_mock.call_count == 0

        relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.status == Relocation.Status.IN_PROGRESS.value
        assert relocation.latest_notified != Relocation.EmailKind.FAILED.value
        assert not relocation.failure_reason

    def test_fail_if_no_attempts_left(
        self,
        preprocessing_colliding_users_mock: Mock,
        fake_message_builder: Mock,
        fake_kms_client: FakeKeyManagementServiceClient,
    ):
        self.relocation.latest_task = OrderedTask.PREPROCESSING_BASELINE_CONFIG.name
        self.relocation.latest_task_attempts = MAX_FAST_TASK_RETRIES
        self.relocation.save()
        RelocationFile.objects.filter(relocation=self.relocation).delete()

        self.mock_message_builder(fake_message_builder)
        self.mock_kms_client(fake_kms_client)
        fake_kms_client.get_public_key.side_effect = Exception("Test")

        with pytest.raises(Exception):
            preprocessing_baseline_config(self.uuid)

        assert fake_kms_client.asymmetric_decrypt.call_count == 0
        assert fake_kms_client.get_public_key.call_count == 1

        assert fake_message_builder.call_count == 1
        assert fake_message_builder.call_args.kwargs["type"] == "relocation.failed"
        fake_message_builder.return_value.send_async.assert_called_once_with(
            to=[self.owner.email, self.superuser.email]
        )

        assert preprocessing_colliding_users_mock.call_count == 0

        relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.status == Relocation.Status.FAILURE.value
        assert relocation.latest_notified == Relocation.EmailKind.FAILED.value
        assert relocation.failure_reason == ERR_PREPROCESSING_INTERNAL


@patch(
    "sentry.backup.crypto.KeyManagementServiceClient",
    new_callable=lambda: FakeKeyManagementServiceClient,
)
@patch("sentry.utils.relocation.MessageBuilder")
@patch("sentry.relocation.tasks.preprocessing_complete.apply_async")
class PreprocessingCollidingUsersTest(RelocationTaskTestCase):
    def setUp(self):
        super().setUp()
        self.relocation.step = Relocation.Step.PREPROCESSING.value
        self.relocation.latest_task = OrderedTask.PREPROCESSING_BASELINE_CONFIG.name
        self.relocation.want_usernames = ["a", "b", "c"]
        self.relocation.save()

        self.create_user("c")
        self.create_user("d")
        self.create_user("e")

        self.relocation_storage = get_relocation_storage()

    def test_success(
        self,
        preprocessing_complete_mock: Mock,
        fake_message_builder: Mock,
        fake_kms_client: FakeKeyManagementServiceClient,
    ):
        self.mock_message_builder(fake_message_builder)
        self.mock_kms_client(fake_kms_client)

        preprocessing_colliding_users(self.uuid)

        assert fake_kms_client.asymmetric_decrypt.call_count == 0
        assert fake_kms_client.get_public_key.call_count == 1
        assert fake_message_builder.call_count == 0
        assert preprocessing_complete_mock.call_count == 1

        (_, files) = self.relocation_storage.listdir(f"runs/{self.uuid}/in")
        assert len(files) == 1
        assert "colliding-users.tar" in files

        with self.relocation_storage.open(f"runs/{self.uuid}/in/colliding-users.tar") as fp:
            json_models = json.loads(
                decrypt_encrypted_tarball(fp, LocalFileDecryptor.from_bytes(self.priv_key_pem))
            )
        assert len(json_models) > 0

        # Only user `c` was colliding, so only they should be exported.
        for json_model in json_models:
            if NormalizedModelName(json_model["model"]) == get_model_name(User):
                assert json_model["fields"]["username"] == "c"

    def test_retry_if_attempts_left(
        self,
        preprocessing_complete_mock: Mock,
        fake_message_builder: Mock,
        fake_kms_client: FakeKeyManagementServiceClient,
    ):
        RelocationFile.objects.filter(relocation=self.relocation).delete()
        self.mock_message_builder(fake_message_builder)
        self.mock_kms_client(fake_kms_client)

        # An exception being raised will trigger a retry in celery.
        with pytest.raises(Exception):
            fake_kms_client.get_public_key.side_effect = Exception("Test")

            preprocessing_colliding_users(self.uuid)

        assert fake_kms_client.asymmetric_decrypt.call_count == 0
        assert fake_kms_client.get_public_key.call_count == 1
        assert fake_message_builder.call_count == 0
        assert preprocessing_complete_mock.call_count == 0

        relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.status == Relocation.Status.IN_PROGRESS.value
        assert relocation.latest_notified != Relocation.EmailKind.FAILED.value
        assert not relocation.failure_reason

    def test_fail_if_no_attempts_left(
        self,
        preprocessing_complete_mock: Mock,
        fake_message_builder: Mock,
        fake_kms_client: FakeKeyManagementServiceClient,
    ):
        self.relocation.latest_task = OrderedTask.PREPROCESSING_COLLIDING_USERS.name
        self.relocation.latest_task_attempts = MAX_FAST_TASK_RETRIES
        self.relocation.save()
        RelocationFile.objects.filter(relocation=self.relocation).delete()

        self.mock_message_builder(fake_message_builder)
        self.mock_kms_client(fake_kms_client)
        fake_kms_client.get_public_key.side_effect = Exception("Test")

        with pytest.raises(Exception):
            preprocessing_colliding_users(self.uuid)

        assert fake_kms_client.asymmetric_decrypt.call_count == 0
        assert fake_kms_client.get_public_key.call_count == 1

        assert fake_message_builder.call_count == 1
        assert fake_message_builder.call_args.kwargs["type"] == "relocation.failed"
        fake_message_builder.return_value.send_async.assert_called_once_with(
            to=[self.owner.email, self.superuser.email]
        )

        assert preprocessing_complete_mock.call_count == 0

        relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.status == Relocation.Status.FAILURE.value
        assert relocation.latest_notified == Relocation.EmailKind.FAILED.value
        assert relocation.failure_reason == ERR_PREPROCESSING_INTERNAL


@patch("sentry.utils.relocation.MessageBuilder")
@patch("sentry.relocation.tasks.validating_start.apply_async")
class PreprocessingCompleteTest(RelocationTaskTestCase):
    def setUp(self):
        super().setUp()
        self.relocation.step = Relocation.Step.PREPROCESSING.value
        self.relocation.latest_task = OrderedTask.PREPROCESSING_COLLIDING_USERS.name
        self.relocation.want_usernames = ["importing"]
        self.relocation.save()
        self.create_user("importing")
        self.relocation_storage = get_relocation_storage()

        self.relocation_storage.save(f"runs/{self.uuid}/conf/cloudbuild.yaml", BytesIO())
        self.relocation_storage.save(f"runs/{self.uuid}/conf/cloudbuild.zip", BytesIO())
        self.relocation_storage.save(f"runs/{self.uuid}/in/filter-usernames.txt", BytesIO())
        self.relocation_storage.save(f"runs/{self.uuid}/in/kms-config.json", BytesIO())
        self.relocation_storage.save(f"runs/{self.uuid}/in/raw-relocation-data.tar", BytesIO())
        self.relocation_storage.save(f"runs/{self.uuid}/in/baseline-config.tar", BytesIO())
        self.relocation_storage.save(f"runs/{self.uuid}/in/colliding-users.tar", BytesIO())

    def test_success(
        self,
        validating_start_mock: Mock,
        fake_message_builder: Mock,
    ):
        self.mock_message_builder(fake_message_builder)

        preprocessing_complete(self.uuid)

        assert fake_message_builder.call_count == 0
        assert validating_start_mock.call_count == 1

        self.relocation.refresh_from_db()
        assert self.relocation.step == Relocation.Step.VALIDATING.value
        assert RelocationValidation.objects.filter(relocation=self.relocation).count() == 1

    def test_retry_if_attempts_left(
        self,
        validating_start_mock: Mock,
        fake_message_builder: Mock,
    ):
        self.relocation_storage.delete(f"runs/{self.uuid}/conf/cloudbuild.yaml")
        self.mock_message_builder(fake_message_builder)

        # An exception being raised will trigger a retry in celery.
        with pytest.raises(Exception):
            preprocessing_complete(self.uuid)

        assert fake_message_builder.call_count == 0
        assert validating_start_mock.call_count == 0

        relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.status == Relocation.Status.IN_PROGRESS.value
        assert relocation.latest_notified != Relocation.EmailKind.FAILED.value
        assert not relocation.failure_reason

    def test_fail_if_no_attempts_left(
        self,
        validating_start_mock: Mock,
        fake_message_builder: Mock,
    ):
        self.relocation.latest_task = OrderedTask.PREPROCESSING_COMPLETE.name
        self.relocation.latest_task_attempts = MAX_FAST_TASK_RETRIES
        self.relocation.save()
        self.relocation_storage.delete(f"runs/{self.uuid}/in/raw-relocation-data.tar")
        self.mock_message_builder(fake_message_builder)

        with pytest.raises(Exception):
            preprocessing_complete(self.uuid)

        assert fake_message_builder.call_count == 1
        assert fake_message_builder.call_args.kwargs["type"] == "relocation.failed"
        fake_message_builder.return_value.send_async.assert_called_once_with(
            to=[self.owner.email, self.superuser.email]
        )

        assert validating_start_mock.call_count == 0

        relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.status == Relocation.Status.FAILURE.value
        assert relocation.latest_notified == Relocation.EmailKind.FAILED.value
        assert relocation.failure_reason == ERR_PREPROCESSING_INTERNAL

    def test_fail_missing_cloudbuild_zip(
        self,
        validating_start_mock: Mock,
        fake_message_builder: Mock,
    ):
        self.relocation_storage.delete(f"runs/{self.uuid}/conf/cloudbuild.zip")
        self.mock_message_builder(fake_message_builder)

        # An exception being raised will trigger a retry in celery.
        with pytest.raises(Exception):
            preprocessing_complete(self.uuid)

        assert fake_message_builder.call_count == 0
        assert validating_start_mock.call_count == 0

        relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.status == Relocation.Status.IN_PROGRESS.value
        assert relocation.latest_notified != Relocation.EmailKind.FAILED.value
        assert not relocation.failure_reason

    def test_fail_missing_filter_usernames_file(
        self,
        validating_start_mock: Mock,
        fake_message_builder: Mock,
    ):
        self.relocation_storage.delete(f"runs/{self.uuid}/in/filter-usernames.txt")
        self.mock_message_builder(fake_message_builder)

        # An exception being raised will trigger a retry in celery.
        with pytest.raises(Exception):
            preprocessing_complete(self.uuid)

        assert fake_message_builder.call_count == 0
        assert validating_start_mock.call_count == 0

        relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.status == Relocation.Status.IN_PROGRESS.value
        assert relocation.latest_notified != Relocation.EmailKind.FAILED.value
        assert not relocation.failure_reason

    def test_fail_missing_kms_config(
        self,
        validating_start_mock: Mock,
        fake_message_builder: Mock,
    ):
        self.relocation_storage.delete(f"runs/{self.uuid}/in/kms-config.json")
        self.mock_message_builder(fake_message_builder)

        # An exception being raised will trigger a retry in celery.
        with pytest.raises(Exception):
            preprocessing_complete(self.uuid)

        assert fake_message_builder.call_count == 0
        assert validating_start_mock.call_count == 0

        relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.status == Relocation.Status.IN_PROGRESS.value
        assert relocation.latest_notified != Relocation.EmailKind.FAILED.value
        assert not relocation.failure_reason


@patch(
    "sentry.relocation.tasks.CloudBuildClient",
    new_callable=lambda: FakeCloudBuildClient,
)
@patch("sentry.utils.relocation.MessageBuilder")
@patch("sentry.relocation.tasks.validating_poll.apply_async")
class ValidatingStartTest(RelocationTaskTestCase):
    def setUp(self):
        super().setUp()
        self.relocation.step = Relocation.Step.PREPROCESSING.value
        self.relocation.latest_task = OrderedTask.PREPROCESSING_COMPLETE.name
        self.relocation.want_usernames = ["testuser"]
        self.relocation.want_org_slugs = ["test-slug"]
        self.relocation.save()

        self.relocation_validation: RelocationValidation = RelocationValidation.objects.create(
            relocation=self.relocation
        )

    def test_success(
        self,
        validating_poll_mock: Mock,
        fake_message_builder: Mock,
        fake_cloudbuild_client: FakeCloudBuildClient,
    ):
        self.mock_cloudbuild_client(fake_cloudbuild_client, Build.Status(Build.Status.QUEUED))
        self.mock_message_builder(fake_message_builder)

        validating_start(self.uuid)

        assert validating_poll_mock.call_count == 1
        assert fake_cloudbuild_client.create_build.call_count == 1

        self.relocation.refresh_from_db()
        self.relocation_validation.refresh_from_db()
        assert self.relocation_validation.status == ValidationStatus.IN_PROGRESS.value
        assert self.relocation_validation.attempts == 1

        relocation_validation_attempt = RelocationValidationAttempt.objects.get(
            relocation_validation=self.relocation_validation
        )
        assert relocation_validation_attempt.status == ValidationStatus.IN_PROGRESS.value

    def test_pause(
        self,
        validating_poll_mock: Mock,
        fake_message_builder: Mock,
        fake_cloudbuild_client: FakeCloudBuildClient,
    ):
        self.mock_cloudbuild_client(fake_cloudbuild_client, Build.Status(Build.Status.QUEUED))
        self.mock_message_builder(fake_message_builder)
        self.relocation.scheduled_pause_at_step = Relocation.Step.VALIDATING.value
        self.relocation.save()

        validating_start(self.uuid)

        assert fake_cloudbuild_client.create_build.call_count == 0
        assert fake_cloudbuild_client.get_build.call_count == 0
        assert fake_message_builder.call_count == 0
        assert validating_poll_mock.call_count == 0

        relocation: Relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.status == Relocation.Status.PAUSE.value
        assert relocation.step == Relocation.Step.VALIDATING.value
        assert relocation.scheduled_pause_at_step is None
        assert relocation.latest_task == OrderedTask.VALIDATING_START.name

    def test_retry_if_attempts_left(
        self,
        validating_poll_mock: Mock,
        fake_message_builder: Mock,
        fake_cloudbuild_client: FakeCloudBuildClient,
    ):
        self.mock_cloudbuild_client(fake_cloudbuild_client, Build.Status(Build.Status.QUEUED))
        self.mock_message_builder(fake_message_builder)

        # An exception being raised will trigger a retry in celery.
        with pytest.raises(Exception):
            fake_cloudbuild_client.create_build.side_effect = Exception("Test")

            validating_start(self.uuid)

        assert fake_cloudbuild_client.create_build.call_count == 1
        assert fake_message_builder.call_count == 0
        assert validating_poll_mock.call_count == 0

        relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.status == Relocation.Status.IN_PROGRESS.value
        assert relocation.latest_notified != Relocation.EmailKind.FAILED.value
        assert not relocation.failure_reason

    def test_fail_if_no_attempts_left(
        self,
        validating_poll_mock: Mock,
        fake_message_builder: Mock,
        fake_cloudbuild_client: FakeCloudBuildClient,
    ):
        self.relocation.latest_task = OrderedTask.VALIDATING_START.name
        self.relocation.latest_task_attempts = MAX_FAST_TASK_RETRIES
        self.relocation.save()

        self.mock_cloudbuild_client(fake_cloudbuild_client, Build.Status(Build.Status.QUEUED))
        fake_cloudbuild_client.create_build.side_effect = Exception("Test")
        self.mock_message_builder(fake_message_builder)

        with pytest.raises(Exception):
            validating_start(self.uuid)

        assert fake_cloudbuild_client.create_build.call_count == 1
        assert fake_message_builder.call_count == 1
        assert validating_poll_mock.call_count == 0

        relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.status == Relocation.Status.FAILURE.value
        assert relocation.latest_notified == Relocation.EmailKind.FAILED.value
        assert relocation.failure_reason == ERR_VALIDATING_INTERNAL

    def test_fail_if_max_runs_attempted(
        self,
        validating_poll_mock: Mock,
        fake_message_builder: Mock,
        fake_cloudbuild_client: FakeCloudBuildClient,
    ):
        for _ in range(3):
            RelocationValidationAttempt.objects.create(
                relocation=self.relocation,
                relocation_validation=self.relocation_validation,
                build_id=uuid4().hex,
            )

        self.relocation_validation.attempts = 3
        self.relocation_validation.save()

        self.relocation.latest_task_attempts = MAX_FAST_TASK_RETRIES
        self.relocation.save()

        self.mock_cloudbuild_client(fake_cloudbuild_client, Build.Status(Build.Status.QUEUED))
        self.mock_message_builder(fake_message_builder)

        validating_start(self.uuid)

        assert fake_cloudbuild_client.create_build.call_count == 0
        assert fake_message_builder.call_count == 1
        assert validating_poll_mock.call_count == 0

        relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.status == Relocation.Status.FAILURE.value
        assert relocation.latest_notified == Relocation.EmailKind.FAILED.value
        assert relocation.failure_reason == ERR_VALIDATING_MAX_RUNS


@patch(
    "sentry.relocation.tasks.CloudBuildClient",
    new_callable=lambda: FakeCloudBuildClient,
)
@patch("sentry.utils.relocation.MessageBuilder")
class ValidatingPollTest(RelocationTaskTestCase):
    def setUp(self):
        super().setUp()
        self.relocation.step = Relocation.Step.VALIDATING.value
        self.relocation.latest_task = OrderedTask.VALIDATING_START.name
        self.relocation.want_usernames = ["testuser"]
        self.relocation.want_org_slugs = ["test-slug"]
        self.relocation.latest_task_attempts = MAX_FAST_TASK_RETRIES
        self.relocation.save()

        self.relocation_validation: RelocationValidation = RelocationValidation.objects.create(
            relocation=self.relocation, attempts=1
        )

        self.relocation_validation_attempt: RelocationValidationAttempt = (
            RelocationValidationAttempt.objects.create(
                relocation=self.relocation,
                relocation_validation=self.relocation_validation,
                build_id=uuid4().hex,
            )
        )

    @patch("sentry.relocation.tasks.validating_complete.apply_async")
    def test_success(
        self,
        validating_complete_mock: Mock,
        fake_message_builder: Mock,
        fake_cloudbuild_client: FakeCloudBuildClient,
    ):
        self.mock_cloudbuild_client(fake_cloudbuild_client, Build.Status(Build.Status.SUCCESS))
        self.mock_message_builder(fake_message_builder)

        validating_poll(self.uuid, self.relocation_validation_attempt.build_id)

        assert fake_cloudbuild_client.get_build.call_count == 1
        assert fake_message_builder.call_count == 0
        assert validating_complete_mock.call_count == 1

        self.relocation.refresh_from_db()
        self.relocation_validation.refresh_from_db()
        self.relocation_validation_attempt.refresh_from_db()
        assert self.relocation_validation.status == ValidationStatus.IN_PROGRESS.value
        assert self.relocation.latest_task == "VALIDATING_POLL"
        assert self.relocation.latest_task_attempts > 0

    @patch("sentry.relocation.tasks.validating_start.apply_async")
    def test_timeout_starts_new_validation_attempt(
        self,
        validating_start_mock: Mock,
        fake_message_builder: Mock,
        fake_cloudbuild_client: FakeCloudBuildClient,
    ):
        for stat in {Build.Status.TIMEOUT, Build.Status.EXPIRED}:
            self.mock_message_builder(fake_message_builder)
            self.mock_cloudbuild_client(fake_cloudbuild_client, Build.Status(stat))
            validating_start_mock.call_count = 0

            validating_poll(self.uuid, self.relocation_validation_attempt.build_id)

            assert fake_cloudbuild_client.get_build.call_count == 1
            assert fake_message_builder.call_count == 0
            assert validating_start_mock.call_count == 1

            self.relocation.refresh_from_db()
            self.relocation_validation.refresh_from_db()
            self.relocation_validation_attempt.refresh_from_db()

            assert self.relocation.latest_task == "VALIDATING_START"
            assert self.relocation.latest_task_attempts == 0
            assert self.relocation_validation.status == ValidationStatus.IN_PROGRESS.value
            assert self.relocation_validation_attempt.status == ValidationStatus.TIMEOUT.value

    @patch("sentry.relocation.tasks.validating_start.apply_async")
    def test_failure_starts_new_validation_attempt(
        self,
        validating_start_mock: Mock,
        fake_message_builder: Mock,
        fake_cloudbuild_client: FakeCloudBuildClient,
    ):
        for stat in {
            Build.Status.FAILURE,
            Build.Status.INTERNAL_ERROR,
            Build.Status.CANCELLED,
        }:
            self.mock_cloudbuild_client(fake_cloudbuild_client, Build.Status(stat))
            self.mock_message_builder(fake_message_builder)
            validating_start_mock.call_count = 0

            validating_poll(self.uuid, self.relocation_validation_attempt.build_id)

            assert fake_cloudbuild_client.get_build.call_count == 1
            assert fake_message_builder.call_count == 0
            assert validating_start_mock.call_count == 1

            self.relocation.refresh_from_db()
            self.relocation_validation.refresh_from_db()
            self.relocation_validation_attempt.refresh_from_db()
            assert self.relocation.latest_task == "VALIDATING_START"
            assert self.relocation.latest_task_attempts == 0
            assert self.relocation_validation.status == ValidationStatus.IN_PROGRESS.value
            assert self.relocation_validation_attempt.status == ValidationStatus.FAILURE.value

    @patch("sentry.relocation.tasks.validating_poll.apply_async")
    def test_in_progress_retries_poll(
        self,
        validating_poll_mock: Mock,
        fake_message_builder: Mock,
        fake_cloudbuild_client: FakeCloudBuildClient,
    ):
        for stat in {
            Build.Status.QUEUED,
            Build.Status.PENDING,
            Build.Status.WORKING,
        }:
            self.mock_cloudbuild_client(fake_cloudbuild_client, Build.Status(stat))
            self.mock_message_builder(fake_message_builder)
            validating_poll_mock.call_count = 0

            validating_poll(self.uuid, self.relocation_validation_attempt.build_id)

            assert fake_cloudbuild_client.get_build.call_count == 1
            assert fake_message_builder.call_count == 0
            assert validating_poll_mock.call_count == 1

            self.relocation.refresh_from_db()
            self.relocation_validation.refresh_from_db()
            self.relocation_validation_attempt.refresh_from_db()
            assert self.relocation.latest_task == "VALIDATING_POLL"
            assert self.relocation.latest_task_attempts > 0
            assert self.relocation_validation.status == ValidationStatus.IN_PROGRESS.value
            assert self.relocation_validation_attempt.status == ValidationStatus.IN_PROGRESS.value
            assert (
                RelocationValidationAttempt.objects.filter(
                    relocation_validation=self.relocation_validation
                ).count()
                == 1
            )

    @patch("sentry.relocation.tasks.validating_poll.apply_async")
    def test_retry_if_attempts_left(
        self,
        validating_poll_mock: Mock,
        fake_message_builder: Mock,
        fake_cloudbuild_client: FakeCloudBuildClient,
    ):
        self.mock_cloudbuild_client(fake_cloudbuild_client, Build.Status(Build.Status.QUEUED))
        self.mock_message_builder(fake_message_builder)
        fake_cloudbuild_client.get_build.side_effect = Exception("Test")

        # An exception being raised will trigger a retry in celery.
        with pytest.raises(Exception):
            validating_poll(self.uuid, self.relocation_validation_attempt.build_id)

        assert fake_cloudbuild_client.get_build.call_count == 1
        assert fake_message_builder.call_count == 0
        assert validating_poll_mock.call_count == 0

        relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.status == Relocation.Status.IN_PROGRESS.value
        assert relocation.latest_notified != Relocation.EmailKind.FAILED.value
        assert not relocation.failure_reason

    @patch("sentry.relocation.tasks.validating_poll.apply_async")
    def test_fail_if_no_attempts_left(
        self,
        validating_poll_mock: Mock,
        fake_message_builder: Mock,
        fake_cloudbuild_client: FakeCloudBuildClient,
    ):
        self.relocation.latest_task = OrderedTask.VALIDATING_POLL.name
        self.relocation.latest_task_attempts = MAX_VALIDATION_POLLS
        self.relocation.save()

        self.mock_cloudbuild_client(fake_cloudbuild_client, Build.Status(Build.Status.QUEUED))
        fake_cloudbuild_client.get_build.side_effect = Exception("Test")
        self.mock_message_builder(fake_message_builder)

        with pytest.raises(Exception):
            validating_poll(self.uuid, self.relocation_validation_attempt.build_id)

        assert fake_cloudbuild_client.get_build.call_count == 1

        assert fake_message_builder.call_count == 1
        assert fake_message_builder.call_args.kwargs["type"] == "relocation.failed"
        fake_message_builder.return_value.send_async.assert_called_once_with(
            to=[self.owner.email, self.superuser.email]
        )

        assert validating_poll_mock.call_count == 0

        relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.status == Relocation.Status.FAILURE.value
        assert relocation.latest_notified == Relocation.EmailKind.FAILED.value
        assert relocation.failure_reason == ERR_VALIDATING_INTERNAL


def mock_invalid_finding(storage: Storage, uuid: UUID):
    storage.save(
        f"runs/{uuid}/findings/import-baseline-config.json",
        BytesIO(
            b"""
[
    {
        "finding": "RpcImportError",
        "kind": "Unknown",
        "left_pk": 2,
        "on": {
            "model": "sentry.email",
            "ordinal": 1
        },
        "reason": "test reason",
        "right_pk": 3
    }
]
            """
        ),
    )


@patch("sentry.utils.relocation.MessageBuilder")
@patch("sentry.relocation.tasks.importing.apply_async")
class ValidatingCompleteTest(RelocationTaskTestCase):
    def setUp(self):
        super().setUp()
        self.relocation.step = Relocation.Step.VALIDATING.value
        self.relocation.latest_task = OrderedTask.VALIDATING_POLL.name
        self.relocation.want_usernames = ["testuser"]
        self.relocation.want_org_slugs = ["test-slug"]
        self.relocation.save()

        self.relocation_validation: RelocationValidation = RelocationValidation.objects.create(
            relocation=self.relocation, attempts=1
        )

        self.relocation_validation_attempt: RelocationValidationAttempt = (
            RelocationValidationAttempt.objects.create(
                relocation=self.relocation,
                relocation_validation=self.relocation_validation,
                build_id=uuid4().hex,
            )
        )

        self.storage = get_relocation_storage()
        self.storage.save(
            f"runs/{self.uuid}/findings/artifacts-prefixes-are-ignored.json",
            BytesIO(b"invalid-json"),
        )
        files = [
            "null.json",
            "import-baseline-config.json",
            "import-colliding-users.json",
            "import-raw-relocation-data.json",
            "export-baseline-config.json",
            "export-colliding-users.json",
            "export-raw-relocation-data.json",
            "compare-baseline-config.json",
            "compare-colliding-users.json",
        ]
        for file in files:
            self.storage.save(f"runs/{self.uuid}/findings/{file}", BytesIO(b"[]"))

    def test_valid(
        self,
        importing_mock: Mock,
        fake_message_builder: Mock,
    ):
        self.mock_message_builder(fake_message_builder)

        validating_complete(self.uuid, self.relocation_validation_attempt.build_id)

        assert fake_message_builder.call_count == 0
        assert importing_mock.call_count == 1

        self.relocation.refresh_from_db()
        self.relocation_validation.refresh_from_db()
        self.relocation_validation_attempt.refresh_from_db()
        assert self.relocation.latest_task == "VALIDATING_COMPLETE"
        assert self.relocation.step == Relocation.Step.IMPORTING.value
        assert self.relocation_validation.status == ValidationStatus.VALID.value
        assert self.relocation_validation_attempt.status == ValidationStatus.VALID.value

    def test_invalid(
        self,
        importing_mock: Mock,
        fake_message_builder: Mock,
    ):
        self.mock_message_builder(fake_message_builder)
        mock_invalid_finding(self.storage, self.uuid)

        validating_complete(self.uuid, self.relocation_validation_attempt.build_id)

        assert fake_message_builder.call_count == 1
        assert fake_message_builder.call_args.kwargs["type"] == "relocation.failed"
        fake_message_builder.return_value.send_async.assert_called_once_with(
            to=[self.owner.email, self.superuser.email]
        )

        assert importing_mock.call_count == 0

        self.relocation.refresh_from_db()
        self.relocation_validation.refresh_from_db()
        self.relocation_validation_attempt.refresh_from_db()
        assert self.relocation.latest_task == "VALIDATING_COMPLETE"
        assert self.relocation.step == Relocation.Step.VALIDATING.value
        assert self.relocation.failure_reason is not None
        assert self.relocation.latest_notified == Relocation.EmailKind.FAILED.value
        assert self.relocation_validation.status == ValidationStatus.INVALID.value
        assert self.relocation_validation_attempt.status == ValidationStatus.INVALID.value

    def test_retry_if_attempts_left(
        self,
        importing_mock: Mock,
        fake_message_builder: Mock,
    ):
        self.mock_message_builder(fake_message_builder)
        self.storage.save(
            f"runs/{self.uuid}/findings/null.json",
            BytesIO(b"invalid-json"),
        )

        assert fake_message_builder.call_count == 0
        assert importing_mock.call_count == 0

        # An exception being raised will trigger a retry in celery.
        with pytest.raises(Exception):
            validating_complete(self.uuid, self.relocation_validation_attempt.build_id)

        relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.status == Relocation.Status.IN_PROGRESS.value
        assert relocation.latest_notified != Relocation.EmailKind.FAILED.value
        assert not relocation.failure_reason

    def test_fail_if_no_attempts_left(
        self,
        importing_mock: Mock,
        fake_message_builder: Mock,
    ):
        self.mock_message_builder(fake_message_builder)
        self.relocation.latest_task = OrderedTask.VALIDATING_COMPLETE.name
        self.relocation.latest_task_attempts = MAX_FAST_TASK_RETRIES
        self.relocation.save()
        self.storage.save(f"runs/{self.uuid}/findings/null.json", BytesIO(b"invalid-json"))

        with pytest.raises(Exception):
            validating_complete(self.uuid, self.relocation_validation_attempt.build_id)

        assert fake_message_builder.call_count == 1
        assert fake_message_builder.call_args.kwargs["type"] == "relocation.failed"
        fake_message_builder.return_value.send_async.assert_called_once_with(
            to=[self.owner.email, self.superuser.email]
        )

        assert importing_mock.call_count == 0

        relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.status == Relocation.Status.FAILURE.value
        assert relocation.latest_notified == Relocation.EmailKind.FAILED.value
        assert relocation.failure_reason == ERR_VALIDATING_INTERNAL


@patch(
    "sentry.backup.crypto.KeyManagementServiceClient",
    new_callable=lambda: FakeKeyManagementServiceClient,
)
@patch("sentry.relocation.tasks.postprocessing.apply_async")
class ImportingTest(RelocationTaskTestCase, TransactionTestCase):
    def setUp(self):
        RelocationTaskTestCase.setUp(self)
        TransactionTestCase.setUp(self)
        self.relocation.step = Relocation.Step.VALIDATING.value
        self.relocation.latest_task = OrderedTask.VALIDATING_COMPLETE.name
        self.relocation.save()
        self.storage = get_relocation_storage()

    def test_success_self_hosted(
        self, postprocessing_mock: Mock, fake_kms_client: FakeKeyManagementServiceClient
    ):
        self.mock_kms_client(fake_kms_client)
        org_count = Organization.objects.filter(slug__startswith="testing").count()

        importing(self.uuid)

        assert postprocessing_mock.call_count == 1
        assert Organization.objects.filter(slug__startswith="testing").count() == org_count + 1
        assert (
            Organization.objects.filter(
                slug__startswith="testing", status=OrganizationStatus.RELOCATION_PENDING_APPROVAL
            ).count()
            == 1
        )

        assert RegionImportChunk.objects.filter(import_uuid=self.uuid).count() == 9
        assert sorted(RegionImportChunk.objects.values_list("model", flat=True)) == [
            "sentry.organization",
            "sentry.organizationmember",
            "sentry.organizationmemberteam",
            "sentry.project",
            "sentry.projectkey",
            "sentry.projectoption",
            "sentry.projectteam",
            "sentry.rule",
            "sentry.team",
        ]

        with assume_test_silo_mode(SiloMode.CONTROL):
            assert ControlImportChunk.objects.filter(import_uuid=self.uuid).count() == 2
            assert sorted(ControlImportChunk.objects.values_list("model", flat=True)) == [
                "sentry.user",
                "sentry.useremail",
            ]

    def test_success_saas_to_saas(
        self, postprocessing_mock: Mock, fake_kms_client: FakeKeyManagementServiceClient
    ):
        org_count = Organization.objects.filter(slug__startswith="testing").count()
        with assume_test_silo_mode(SiloMode.CONTROL):
            user_count = User.objects.all().count()

        # Create an export checkpointer, so that we can validate that it stores checkpoints properly
        # over multiple export attempts.
        decryptor = LocalFileDecryptor(BytesIO(self.priv_key_pem))
        encryptor = LocalFileEncryptor(BytesIO(self.pub_key_pem))
        export_checkpointer = StorageBackedCheckpointExporter(
            crypto=EncryptorDecryptorPair(
                encryptor=encryptor,
                decryptor=decryptor,
            ),
            uuid=self.relocation.uuid,
            storage=self.storage,
        )
        with TemporaryDirectory() as tmp_dir:
            tmp_priv_key_path = Path(tmp_dir).joinpath("key")
            tmp_pub_key_path = Path(tmp_dir).joinpath("key.pub")
            with open(tmp_priv_key_path, "wb") as f:
                f.write(self.priv_key_pem)
            with open(tmp_pub_key_path, "wb") as f:
                f.write(self.pub_key_pem)

        # Export the existing state of the `testing` organization, so that we retain exact ids.
        export_contents = BytesIO()
        export_in_organization_scope(
            export_contents,
            org_filter=set(self.relocation.want_org_slugs),
            printer=Printer(),
            checkpointer=export_checkpointer,
        )

        # Verify cache writes, to the checkpoint cache.
        (_, num_checkpoints) = self.storage.listdir(
            f"runs/{self.relocation.uuid}/saas_to_saas_export/_checkpoints/"
        )
        assert len(num_checkpoints) > 0

        # Export again, to sanity-check the export checkpointer.
        reexport_contents = BytesIO()
        export_in_organization_scope(
            reexport_contents,
            org_filter=set(self.relocation.want_org_slugs),
            printer=Printer(),
            checkpointer=export_checkpointer,
        )

        # Verify no cache writes, to the checkpoint cache on the second pass, then check for output
        # equality.
        (_, num_recheckpoints) = self.storage.listdir(
            f"runs/{self.relocation.uuid}/saas_to_saas_export/_checkpoints/"
        )
        assert num_checkpoints == num_recheckpoints
        assert export_contents.getvalue() == reexport_contents.getvalue()
        export_contents.seek(0)

        # Convert this into a `SAAS_TO_SAAS` relocation, and use the data we just exported as the
        # import blob.
        file = RelocationFile.objects.get(relocation=self.relocation).file
        self.tarball = create_encrypted_export_tarball(
            json.load(export_contents), encryptor
        ).getvalue()
        file.putfile(BytesIO(self.tarball), blob_size=RELOCATION_BLOB_SIZE)
        self.mock_kms_client(fake_kms_client)
        self.relocation.provenance = Relocation.Provenance.SAAS_TO_SAAS
        self.relocation.save()

        # Now, try importing again, which should enable user merging.
        importing(self.uuid)

        with assume_test_silo_mode(SiloMode.CONTROL):
            # User counts should NOT change, since `merge_users` should be enabled.
            assert User.objects.all().count() == user_count
            common_user = User.objects.get(username="existing_org_owner@example.com")

        # The existing user should now be in both orgs.
        assert OrganizationMember.objects.filter(user_id=common_user.id).count() == 2

        assert postprocessing_mock.call_count == 1
        assert Organization.objects.filter(slug__startswith="testing").count() == org_count + 1
        assert (
            Organization.objects.filter(
                slug__startswith="testing", status=OrganizationStatus.RELOCATION_PENDING_APPROVAL
            ).count()
            == 1
        )

        with assume_test_silo_mode(SiloMode.CONTROL):
            assert ControlImportChunk.objects.filter(import_uuid=self.uuid).count() == 1
            assert sorted(ControlImportChunk.objects.values_list("model", flat=True)) == [
                "sentry.user",
                # We don't overwrite `sentry.useremail`, retaining the existing value instead.
            ]

    def test_pause(
        self,
        postprocessing_mock: Mock,
        fake_kms_client: FakeKeyManagementServiceClient,
    ):
        self.mock_kms_client(fake_kms_client)
        self.relocation.scheduled_pause_at_step = Relocation.Step.IMPORTING.value
        self.relocation.save()

        importing(self.uuid)

        assert fake_kms_client.asymmetric_decrypt.call_count == 0
        assert fake_kms_client.get_public_key.call_count == 0
        assert postprocessing_mock.call_count == 0

        relocation: Relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.status == Relocation.Status.PAUSE.value
        assert relocation.step == Relocation.Step.IMPORTING.value
        assert relocation.scheduled_pause_at_step is None
        assert relocation.latest_task == OrderedTask.IMPORTING.name


@patch("sentry.utils.relocation.MessageBuilder")
@patch("sentry.signals.relocated.send_robust")
@patch("sentry.signals.relocation_redeem_promo_code.send_robust")
@patch("sentry.relocation.tasks.notifying_unhide.apply_async")
@patch("sentry.analytics.record")
class PostprocessingTest(RelocationTaskTestCase):
    def setUp(self):
        RelocationTaskTestCase.setUp(self)
        TransactionTestCase.setUp(self)
        self.relocation.step = Relocation.Step.IMPORTING.value
        self.relocation.latest_task = OrderedTask.IMPORTING.name
        self.relocation.save()

        with open(IMPORT_JSON_FILE_PATH, "rb") as fp:
            import_in_organization_scope(
                fp,
                flags=ImportFlags(
                    import_uuid=str(self.uuid),
                    hide_organizations=True,
                    merge_users=False,
                    overwrite_configs=False,
                ),
                org_filter=set(self.relocation.want_org_slugs),
                printer=Printer(),
            )

        imported_orgs = RegionImportChunk.objects.get(
            import_uuid=self.uuid, model="sentry.organization"
        )
        assert len(imported_orgs.inserted_map) == 1
        assert len(imported_orgs.inserted_identifiers) == 1

        self.imported_org_id: int = next(iter(imported_orgs.inserted_map.values()))
        self.imported_org_slug: str = next(iter(imported_orgs.inserted_identifiers.values()))

    @staticmethod
    def noop_relocated_signal_receiver(sender, **kwargs) -> None:
        raise NotImplementedError

    def test_success(
        self,
        analytics_record_mock: Mock,
        notifying_unhide_mock: Mock,
        relocation_redeem_promo_code_signal_mock: Mock,
        relocated_signal_mock: Mock,
        fake_message_builder: Mock,
    ):
        self.mock_message_builder(fake_message_builder)
        assert (
            Organization.objects.filter(
                slug__startswith="testing", status=OrganizationStatus.RELOCATION_PENDING_APPROVAL
            ).count()
            == 1
        )
        assert (
            OrganizationMember.objects.filter(
                organization_id=self.imported_org_id, role="owner", has_global_access=True
            ).count()
            == 1
        )
        assert not OrganizationMember.objects.filter(
            organization_id=self.imported_org_id, user_id=self.owner.id
        ).exists()

        postprocessing(self.uuid)

        assert relocated_signal_mock.call_count == 1
        assert relocation_redeem_promo_code_signal_mock.call_count == 1
        assert notifying_unhide_mock.call_count == 1

        assert (
            Organization.objects.filter(
                slug__startswith="testing", status=OrganizationStatus.RELOCATION_PENDING_APPROVAL
            ).count()
            == 1
        )
        assert (
            OrganizationMember.objects.filter(
                organization_id=self.imported_org_id, role="owner", has_global_access=True
            ).count()
            == 2
        )
        assert OrganizationMember.objects.filter(
            organization_id=self.imported_org_id, user_id=self.owner.id
        ).exists()

        relocation = Relocation.objects.get(uuid=self.uuid)

        analytics_record_mock.assert_called_with(
            "relocation.organization_imported",
            organization_id=self.imported_org_id,
            relocation_uuid=str(relocation.uuid),
            slug=self.imported_org_slug,
            owner_id=self.owner.id,
        )

        imported_org = Organization.objects.get(slug=self.imported_org_slug)

        relocation_redeem_promo_code_signal_mock.assert_called_with(
            sender=postprocessing,
            relocation_uuid=str(relocation.uuid),
            user_id=self.owner.id,
            orgs=[imported_org],
        )

    def test_pause(
        self,
        analytics_record_mock: Mock,
        notifying_unhide_mock: Mock,
        relocation_redeem_promo_code_signal_mock: Mock,
        relocated_signal_mock: Mock,
        fake_message_builder: Mock,
    ):
        self.relocation.scheduled_pause_at_step = Relocation.Step.POSTPROCESSING.value
        self.relocation.save()

        postprocessing(self.uuid)

        assert fake_message_builder.call_count == 0
        assert relocated_signal_mock.call_count == 0
        assert notifying_unhide_mock.call_count == 0

        relocation: Relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.status == Relocation.Status.PAUSE.value
        assert relocation.step == Relocation.Step.POSTPROCESSING.value
        assert relocation.scheduled_pause_at_step is None
        assert relocation.latest_task == OrderedTask.POSTPROCESSING.name

        analytics_record_mock.assert_not_called()
        relocation_redeem_promo_code_signal_mock.assert_not_called()

    def test_retry_if_attempts_left(
        self,
        analytics_record_mock: Mock,
        notifying_unhide_mock: Mock,
        relocation_redeem_promo_code_signal_mock: Mock,
        relocated_signal_mock: Mock,
        fake_message_builder: Mock,
    ):
        self.mock_message_builder(fake_message_builder)
        relocated_signal_mock.side_effect = [
            (self.noop_relocated_signal_receiver, None),
            (self.noop_relocated_signal_receiver, Exception("receiver failure")),
        ]
        self.relocation.save()

        # An exception being raised will trigger a retry in celery.
        with pytest.raises(Exception):
            postprocessing(self.uuid)

        assert fake_message_builder.call_count == 0
        assert relocated_signal_mock.call_count == 1
        assert notifying_unhide_mock.call_count == 0

        relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.status == Relocation.Status.IN_PROGRESS.value
        assert relocation.latest_notified != Relocation.EmailKind.FAILED.value
        assert not relocation.failure_reason

        # Technically this should be called, but since we're mocking out the `send_robust` function, it won't
        analytics_record_mock.assert_not_called()
        relocation_redeem_promo_code_signal_mock.assert_not_called()

    def test_fail_if_no_attempts_left(
        self,
        analytics_record_mock: Mock,
        notifying_unhide_mock: Mock,
        relocation_redeem_promo_code_signal_mock: Mock,
        relocated_signal_mock: Mock,
        fake_message_builder: Mock,
    ):
        self.mock_message_builder(fake_message_builder)
        self.relocation.latest_task = OrderedTask.POSTPROCESSING.name
        self.relocation.latest_task_attempts = MAX_FAST_TASK_RETRIES
        relocated_signal_mock.side_effect = [
            (self.noop_relocated_signal_receiver, None),
            (self.noop_relocated_signal_receiver, Exception("receiver failure")),
        ]
        self.relocation.save()

        with pytest.raises(Exception):
            postprocessing(self.uuid)

        assert fake_message_builder.call_count == 1
        assert fake_message_builder.call_args.kwargs["type"] == "relocation.failed"
        fake_message_builder.return_value.send_async.assert_called_once_with(
            to=[self.owner.email, self.superuser.email]
        )

        assert relocated_signal_mock.call_count == 1
        assert notifying_unhide_mock.call_count == 0

        relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.status == Relocation.Status.FAILURE.value
        assert relocation.latest_notified == Relocation.EmailKind.FAILED.value
        assert relocation.failure_reason == ERR_POSTPROCESSING_INTERNAL
        analytics_record_mock.assert_not_called()
        relocation_redeem_promo_code_signal_mock.assert_not_called()


@patch("sentry.utils.relocation.MessageBuilder")
@patch("sentry.relocation.tasks.notifying_users.apply_async")
class NotifyingUnhideTest(RelocationTaskTestCase):
    def setUp(self):
        RelocationTaskTestCase.setUp(self)
        TransactionTestCase.setUp(self)
        self.relocation.step = Relocation.Step.POSTPROCESSING.value
        self.relocation.latest_task = OrderedTask.POSTPROCESSING.name
        self.relocation.save()

        with open(IMPORT_JSON_FILE_PATH, "rb") as fp:
            import_in_organization_scope(
                fp,
                flags=ImportFlags(
                    import_uuid=str(self.uuid),
                    hide_organizations=True,
                    merge_users=False,
                    overwrite_configs=False,
                ),
                org_filter=set(self.relocation.want_org_slugs),
                printer=Printer(),
            )

        imported_orgs = RegionImportChunk.objects.get(
            import_uuid=self.uuid, model="sentry.organization"
        )
        assert len(imported_orgs.inserted_map) == 1
        assert len(imported_orgs.inserted_identifiers) == 1

        self.imported_org_id: int = next(iter(imported_orgs.inserted_map.values()))
        self.imported_org_slug: str = next(iter(imported_orgs.inserted_identifiers.values()))
        assert (
            Organization.objects.filter(
                slug=self.imported_org_slug, status=OrganizationStatus.RELOCATION_PENDING_APPROVAL
            ).count()
            == 1
        )

    def test_success(
        self,
        notifying_users_mock: Mock,
        fake_message_builder: Mock,
    ):
        self.mock_message_builder(fake_message_builder)

        notifying_unhide(self.uuid)

        assert not (
            Organization.objects.filter(
                slug=self.imported_org_slug,
                status=OrganizationStatus.RELOCATION_PENDING_APPROVAL,
            ).exists()
        )

        assert fake_message_builder.call_count == 0
        assert notifying_users_mock.call_count == 1

    def test_pause(
        self,
        notifying_users_mock: Mock,
        fake_message_builder: Mock,
    ):
        self.relocation.scheduled_pause_at_step = Relocation.Step.NOTIFYING.value
        self.relocation.save()

        notifying_unhide(self.uuid)

        assert (
            Organization.objects.filter(
                slug=self.imported_org_slug, status=OrganizationStatus.RELOCATION_PENDING_APPROVAL
            ).count()
            == 1
        )

        assert fake_message_builder.call_count == 0
        assert notifying_users_mock.call_count == 0

        relocation: Relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.status == Relocation.Status.PAUSE.value
        assert relocation.step == Relocation.Step.NOTIFYING.value
        assert relocation.scheduled_pause_at_step is None
        assert relocation.latest_task == OrderedTask.NOTIFYING_UNHIDE.name


@patch("sentry.utils.relocation.MessageBuilder")
@patch("sentry.relocation.tasks.notifying_owner.apply_async")
class NotifyingUsersTest(RelocationTaskTestCase):
    def setUp(self):
        RelocationTaskTestCase.setUp(self)
        TransactionTestCase.setUp(self)
        self.relocation.step = Relocation.Step.NOTIFYING.value
        self.relocation.latest_task = OrderedTask.NOTIFYING_UNHIDE.name
        self.relocation.want_usernames = ["admin@example.com", "member@example.com"]
        self.relocation.save()

        with open(IMPORT_JSON_FILE_PATH, "rb") as fp:
            import_in_organization_scope(
                fp,
                flags=ImportFlags(
                    import_uuid=str(self.uuid),
                    hide_organizations=True,
                    merge_users=False,
                    overwrite_configs=False,
                ),
                org_filter=set(self.relocation.want_org_slugs),
                printer=Printer(),
            )

        self.imported_orgs = sorted(
            RegionImportChunk.objects.get(
                import_uuid=self.uuid, model="sentry.organization"
            ).inserted_identifiers.values()
        )
        assert len(self.imported_orgs) == 1

        self.imported_users = ControlImportChunkReplica.objects.get(
            import_uuid=self.uuid, model="sentry.user"
        ).inserted_map
        assert len(self.imported_users) == 2

    def test_success(
        self,
        notifying_owner_mock: Mock,
        fake_message_builder: Mock,
    ):
        self.mock_message_builder(fake_message_builder)

        with patch.object(LostPasswordHash, "send_relocate_account_email") as mock_relocation_email:
            notifying_users(self.uuid)

            # Called once for each user imported, which is 2 for `fresh-install.json`
            assert mock_relocation_email.call_count == 2
            email_targets = [
                mock_relocation_email.call_args_list[0][0][0].username,
                mock_relocation_email.call_args_list[1][0][0].username,
            ]
            assert sorted(mock_relocation_email.call_args_list[0][0][2]) == self.imported_orgs
            assert sorted(mock_relocation_email.call_args_list[1][0][2]) == self.imported_orgs
            assert "admin@example.com" in email_targets
            assert "member@example.com" in email_targets

            assert fake_message_builder.call_count == 0
            assert notifying_owner_mock.call_count == 1

            relocation: Relocation = Relocation.objects.get(uuid=self.uuid)
            assert relocation.latest_unclaimed_emails_sent_at is not None

    def test_success_ignore_manually_claimed_users(
        self,
        notifying_owner_mock: Mock,
        fake_message_builder: Mock,
    ):
        with assume_test_silo_mode(SiloMode.CONTROL):
            admin: User = User.objects.get(id=self.imported_users["1"], email="admin@example.com")
            admin.is_unclaimed = False
            admin.save()

        self.mock_message_builder(fake_message_builder)

        with patch.object(LostPasswordHash, "send_relocate_account_email") as mock_relocation_email:
            notifying_users(self.uuid)

            # Called once for each user imported that has not been manually claimed. Since we
            # imported 2 users in `fresh-install.json`, but then manually claimed one at the top of
            # this test, only one user remains.
            assert mock_relocation_email.call_count == 1
            email_targets = [
                mock_relocation_email.call_args_list[0][0][0].username,
            ]
            assert sorted(mock_relocation_email.call_args_list[0][0][2]) == self.imported_orgs
            assert "member@example.com" in email_targets
            assert "admin@example.com" not in email_targets

            assert fake_message_builder.call_count == 0
            assert notifying_owner_mock.call_count == 1

            relocation: Relocation = Relocation.objects.get(uuid=self.uuid)
            assert relocation.latest_unclaimed_emails_sent_at is not None

    def test_retry_if_attempts_left(
        self,
        notifying_owner_mock: Mock,
        fake_message_builder: Mock,
    ):
        self.mock_message_builder(fake_message_builder)
        self.relocation.want_usernames = ["doesnotexist"]
        self.relocation.save()

        # An exception being raised will trigger a retry in celery.
        with pytest.raises(Exception):
            notifying_users(self.uuid)

        assert fake_message_builder.call_count == 0
        assert notifying_owner_mock.call_count == 0

        relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.status == Relocation.Status.IN_PROGRESS.value
        assert relocation.latest_notified != Relocation.EmailKind.FAILED.value
        assert not relocation.failure_reason

    def test_fail_if_no_attempts_left(
        self,
        notifying_owner_mock: Mock,
        fake_message_builder: Mock,
    ):
        self.mock_message_builder(fake_message_builder)
        self.relocation.latest_task = OrderedTask.NOTIFYING_USERS.name
        self.relocation.latest_task_attempts = MAX_FAST_TASK_RETRIES
        self.relocation.want_usernames = ["doesnotexist"]
        self.relocation.save()

        with pytest.raises(Exception):
            notifying_users(self.uuid)

        assert fake_message_builder.call_count == 1
        assert fake_message_builder.call_args.kwargs["type"] == "relocation.failed"
        fake_message_builder.return_value.send_async.assert_called_once_with(
            to=[self.owner.email, self.superuser.email]
        )
        assert notifying_owner_mock.call_count == 0

        relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.status == Relocation.Status.FAILURE.value
        assert relocation.latest_notified == Relocation.EmailKind.FAILED.value
        assert relocation.failure_reason == ERR_NOTIFYING_INTERNAL


@patch("sentry.utils.relocation.MessageBuilder")
@patch("sentry.relocation.tasks.completed.apply_async")
class NotifyingOwnerTest(RelocationTaskTestCase):
    def setUp(self):
        RelocationTaskTestCase.setUp(self)
        TransactionTestCase.setUp(self)
        self.relocation.step = Relocation.Step.NOTIFYING.value
        self.relocation.latest_task = OrderedTask.NOTIFYING_USERS.name
        self.relocation.save()

        RegionImportChunk.objects.create(
            import_uuid=self.relocation.uuid,
            model="sentry.organization",
            min_ordinal=0,
            max_ordinal=0,
            min_source_pk=1,
            max_source_pk=1,
            inserted_map={1: 1234},
            inserted_identifiers={1: "testing-ab"},
        )
        self.imported_orgs = ["testing-ab"]

    def test_success_admin_assisted_relocation(
        self,
        completed_mock: Mock,
        fake_message_builder: Mock,
    ):
        self.mock_message_builder(fake_message_builder)

        notifying_owner(self.uuid)

        assert fake_message_builder.call_count == 1
        assert fake_message_builder.call_args.kwargs["type"] == "relocation.succeeded"
        assert fake_message_builder.call_args.kwargs["context"]["orgs"] == self.imported_orgs
        fake_message_builder.return_value.send_async.assert_called_once_with(
            to=[self.owner.email, self.superuser.email]
        )

        assert completed_mock.call_count == 1

        relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.latest_notified == Relocation.EmailKind.SUCCEEDED.value

    def test_success_self_serve_relocation(
        self,
        completed_mock: Mock,
        fake_message_builder: Mock,
    ):
        self.mock_message_builder(fake_message_builder)
        self.relocation.creator_id = self.relocation.owner_id
        self.relocation.save()

        notifying_owner(self.uuid)

        assert fake_message_builder.call_count == 1
        assert fake_message_builder.call_args.kwargs["type"] == "relocation.succeeded"
        assert fake_message_builder.call_args.kwargs["context"]["orgs"] == self.imported_orgs
        fake_message_builder.return_value.send_async.assert_called_once_with(to=[self.owner.email])

        assert completed_mock.call_count == 1

        relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.latest_notified == Relocation.EmailKind.SUCCEEDED.value

    def test_retry_if_attempts_left(
        self,
        completed_mock: Mock,
        fake_message_builder: Mock,
    ):
        self.mock_message_builder(fake_message_builder)
        fake_message_builder.return_value.send_async.side_effect = Exception("Test")

        # An exception being raised will trigger a retry in celery.
        with pytest.raises(Exception):
            notifying_owner(self.uuid)

        assert fake_message_builder.call_count == 1
        assert completed_mock.call_count == 0

        relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.status == Relocation.Status.IN_PROGRESS.value
        assert relocation.latest_notified != Relocation.EmailKind.FAILED.value
        assert not relocation.failure_reason

    def test_fail_if_no_attempts_left(
        self,
        completed_mock: Mock,
        fake_message_builder: Mock,
    ):
        self.relocation.latest_task = OrderedTask.NOTIFYING_OWNER.name
        self.relocation.latest_task_attempts = MAX_FAST_TASK_RETRIES
        self.relocation.save()

        self.mock_message_builder(fake_message_builder)
        fake_message_builder.return_value.send_async.side_effect = [Exception("Test"), None]

        with pytest.raises(Exception):
            notifying_owner(self.uuid)

        # Oh, the irony: sending the "relocation success" email failed, so we send a "relocation
        # failed" email instead...
        assert fake_message_builder.call_count == 2
        email_types = [args.kwargs["type"] for args in fake_message_builder.call_args_list]
        assert "relocation.failed" in email_types
        assert "relocation.succeeded" in email_types

        assert completed_mock.call_count == 0

        relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.status == Relocation.Status.FAILURE.value
        assert relocation.latest_notified == Relocation.EmailKind.FAILED.value
        assert relocation.failure_reason == ERR_NOTIFYING_INTERNAL


class CompletedTest(RelocationTaskTestCase):
    def setUp(self):
        RelocationTaskTestCase.setUp(self)
        TransactionTestCase.setUp(self)
        self.relocation.step = Relocation.Step.NOTIFYING.value
        self.relocation.latest_task = OrderedTask.NOTIFYING_OWNER.name
        self.relocation.save()

    def test_success(self):
        completed(self.uuid)

        relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.status == Relocation.Status.SUCCESS.value
        assert not relocation.failure_reason


@patch(
    "sentry.backup.crypto.KeyManagementServiceClient",
    new_callable=lambda: FakeKeyManagementServiceClient,
)
@patch(
    "sentry.relocation.tasks.CloudBuildClient",
    new_callable=lambda: FakeCloudBuildClient,
)
@patch("sentry.utils.relocation.MessageBuilder")
@patch("sentry.signals.relocated.send_robust")
@patch("sentry.signals.relocation_redeem_promo_code.send_robust")
@patch("sentry.analytics.record")
class EndToEndTest(RelocationTaskTestCase, TransactionTestCase):
    def setUp(self):
        RelocationTaskTestCase.setUp(self)
        TransactionTestCase.setUp(self)

        self.storage = get_relocation_storage()
        files = [
            "null.json",
            "import-baseline-config.json",
            "import-colliding-users.json",
            "import-raw-relocation-data.json",
            "export-baseline-config.json",
            "export-colliding-users.json",
            "export-raw-relocation-data.json",
            "compare-baseline-config.json",
            "compare-colliding-users.json",
        ]
        for file in files:
            self.storage.save(f"runs/{self.relocation.uuid}/findings/{file}", BytesIO(b"[]"))

    def mock_max_retries(
        self,
        fake_cloudbuild_client: FakeCloudBuildClient,
        fake_kms_client: FakeKeyManagementServiceClient,
    ):
        fake_cloudbuild_client.create_build.side_effect = (
            [BurstTaskRunnerRetryError("Retry")] * MAX_FAST_TASK_RETRIES
        ) + [fake_cloudbuild_client.create_build.return_value]

        fake_cloudbuild_client.get_build.side_effect = (
            [BurstTaskRunnerRetryError("Retry")] * MAX_VALIDATION_POLLS
        ) + [fake_cloudbuild_client.get_build.return_value]

        fake_kms_client.asymmetric_decrypt.side_effect = (
            [BurstTaskRunnerRetryError("Retry")] * MAX_FAST_TASK_RETRIES
        ) + [
            fake_kms_client.asymmetric_decrypt.return_value,
            # The second call to `asymmetric_decrypt` occurs from inside the `importing` task, which
            # is not retried.
            fake_kms_client.asymmetric_decrypt.return_value,
        ]

        fake_kms_client.get_public_key.side_effect = (
            [BurstTaskRunnerRetryError("Retry")] * MAX_FAST_TASK_RETRIES
        ) + [fake_kms_client.get_public_key.return_value]
        # Used by two tasks, so repeat the pattern (fail, fail, fail, succeed) twice.
        fake_kms_client.get_public_key.side_effect = (
            list(fake_kms_client.get_public_key.side_effect) * 2
        )

    def assert_success_database_state(self, org_count: int):
        assert Organization.objects.filter(slug__startswith="testing").count() == org_count + 1

        assert RegionImportChunk.objects.filter(import_uuid=self.uuid).count() == 9
        assert sorted(RegionImportChunk.objects.values_list("model", flat=True)) == [
            "sentry.organization",
            "sentry.organizationmember",
            "sentry.organizationmemberteam",
            "sentry.project",
            "sentry.projectkey",
            "sentry.projectoption",
            "sentry.projectteam",
            "sentry.rule",
            "sentry.team",
        ]

        assert ControlImportChunkReplica.objects.filter(import_uuid=self.uuid).count() == 2
        with assume_test_silo_mode(SiloMode.CONTROL):
            assert ControlImportChunk.objects.filter(import_uuid=self.uuid).count() == 2
            assert sorted(ControlImportChunk.objects.values_list("model", flat=True)) == [
                "sentry.user",
                "sentry.useremail",
            ]

    def assert_failure_database_state(self, org_count: int):
        assert Organization.objects.filter(slug__startswith="testing").count() == org_count
        assert RegionImportChunk.objects.filter(import_uuid=self.uuid).count() == 0

        assert ControlImportChunkReplica.objects.filter(import_uuid=self.uuid).count() == 0
        with assume_test_silo_mode(SiloMode.CONTROL):
            assert ControlImportChunk.objects.filter(import_uuid=self.uuid).count() == 0

    def assert_success_analytics_record(self, analytics_record_mock: Mock):
        imported_orgs = RegionImportChunk.objects.get(
            import_uuid=self.uuid, model="sentry.organization"
        )

        imported_org_id: int = next(iter(imported_orgs.inserted_map.values()))
        imported_org_slug: str = next(iter(imported_orgs.inserted_identifiers.values()))

        analytics_record_mock.assert_called_with(
            "relocation.organization_imported",
            organization_id=imported_org_id,
            relocation_uuid=str(self.uuid),
            slug=imported_org_slug,
            owner_id=self.owner.id,
        )

    def test_valid_no_retries(
        self,
        analytics_record_mock: Mock,
        relocation_redeem_promo_code_signal_mock: Mock,
        relocated_signal_mock: Mock,
        fake_message_builder: Mock,
        fake_cloudbuild_client: FakeCloudBuildClient,
        fake_kms_client: FakeKeyManagementServiceClient,
    ):
        self.mock_cloudbuild_client(fake_cloudbuild_client, Build.Status(Build.Status.SUCCESS))
        self.mock_kms_client(fake_kms_client)
        self.mock_message_builder(fake_message_builder)
        org_count = Organization.objects.filter(slug__startswith="testing").count()

        with BurstTaskRunner() as burst:
            uploading_start(self.relocation.uuid, None, None)

            with patch.object(
                LostPasswordHash, "send_relocate_account_email"
            ) as mock_relocation_email:
                burst()

            assert mock_relocation_email.call_count == 2

        assert fake_cloudbuild_client.create_build.call_count == 1
        assert fake_cloudbuild_client.get_build.call_count == 1

        assert fake_kms_client.asymmetric_decrypt.call_count == 2
        assert fake_kms_client.get_public_key.call_count == 2

        assert fake_message_builder.call_count == 2
        email_types = [args.kwargs["type"] for args in fake_message_builder.call_args_list]
        assert "relocation.started" in email_types
        assert "relocation.succeeded" in email_types
        assert "relocation.failed" not in email_types

        assert relocated_signal_mock.call_count == 1
        assert relocation_redeem_promo_code_signal_mock.call_count == 1

        relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.status == Relocation.Status.SUCCESS.value
        assert relocation.latest_notified == Relocation.EmailKind.SUCCEEDED.value
        assert not relocation.failure_reason

        self.assert_success_database_state(org_count)
        self.assert_success_analytics_record(analytics_record_mock)

    def test_valid_max_retries(
        self,
        analytics_record_mock: Mock,
        relocation_redeem_promo_code_signal_mock: Mock,
        relocated_signal_mock: Mock,
        fake_message_builder: Mock,
        fake_cloudbuild_client: FakeCloudBuildClient,
        fake_kms_client: FakeKeyManagementServiceClient,
    ):
        self.mock_cloudbuild_client(fake_cloudbuild_client, Build.Status(Build.Status.SUCCESS))
        self.mock_kms_client(fake_kms_client)
        self.mock_max_retries(fake_cloudbuild_client, fake_kms_client)

        self.mock_message_builder(fake_message_builder)
        org_count = Organization.objects.filter(slug__startswith="testing").count()

        with BurstTaskRunner() as burst:
            uploading_start(self.relocation.uuid, None, None)

            with patch.object(
                LostPasswordHash, "send_relocate_account_email"
            ) as mock_relocation_email:
                burst()

            assert mock_relocation_email.call_count == 2

        assert fake_cloudbuild_client.create_build.call_count == MAX_FAST_TASK_ATTEMPTS
        assert fake_cloudbuild_client.get_build.call_count == MAX_VALIDATION_POLL_ATTEMPTS

        assert fake_kms_client.asymmetric_decrypt.call_count == MAX_FAST_TASK_ATTEMPTS + 1
        assert fake_kms_client.get_public_key.call_count == 2 * MAX_FAST_TASK_ATTEMPTS

        assert fake_message_builder.call_count == 2
        email_types = [args.kwargs["type"] for args in fake_message_builder.call_args_list]
        assert "relocation.started" in email_types
        assert "relocation.succeeded" in email_types
        assert "relocation.failed" not in email_types

        assert relocated_signal_mock.call_count == 1
        assert relocation_redeem_promo_code_signal_mock.call_count == 1

        relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.status == Relocation.Status.SUCCESS.value
        assert relocation.latest_notified == Relocation.EmailKind.SUCCEEDED.value
        assert not relocation.failure_reason

        self.assert_success_database_state(org_count)
        self.assert_success_analytics_record(analytics_record_mock)

    def test_invalid_no_retries(
        self,
        analytics_record_mock: Mock,
        relocation_redeem_promo_code_signal_mock: Mock,
        relocated_signal_mock: Mock,
        fake_message_builder: Mock,
        fake_cloudbuild_client: FakeCloudBuildClient,
        fake_kms_client: FakeKeyManagementServiceClient,
    ):
        self.mock_cloudbuild_client(fake_cloudbuild_client, Build.Status(Build.Status.SUCCESS))
        self.mock_kms_client(fake_kms_client)
        self.mock_message_builder(fake_message_builder)
        mock_invalid_finding(self.storage, self.uuid)
        org_count = Organization.objects.filter(slug__startswith="testing").count()

        with BurstTaskRunner() as burst:
            uploading_start(self.relocation.uuid, None, None)

            with patch.object(
                LostPasswordHash, "send_relocate_account_email"
            ) as mock_relocation_email:
                burst()

            assert mock_relocation_email.call_count == 0

        assert fake_cloudbuild_client.create_build.call_count == 1
        assert fake_cloudbuild_client.get_build.call_count == 1

        assert fake_kms_client.asymmetric_decrypt.call_count == 1
        assert fake_kms_client.get_public_key.call_count == 2

        assert fake_message_builder.call_count == 2
        email_types = [args.kwargs["type"] for args in fake_message_builder.call_args_list]
        assert "relocation.started" in email_types
        assert "relocation.failed" in email_types
        assert "relocation.succeeded" not in email_types

        assert relocated_signal_mock.call_count == 0
        assert relocation_redeem_promo_code_signal_mock.call_count == 0

        relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.status == Relocation.Status.FAILURE.value
        assert relocation.latest_notified == Relocation.EmailKind.FAILED.value
        assert relocation.failure_reason

        self.assert_failure_database_state(org_count)
        analytics_record_mock.assert_not_called()

    def test_invalid_max_retries(
        self,
        analytics_record_mock: Mock,
        relocation_redeem_promo_code_signal_mock: Mock,
        relocated_signal_mock: Mock,
        fake_message_builder: Mock,
        fake_cloudbuild_client: FakeCloudBuildClient,
        fake_kms_client: FakeKeyManagementServiceClient,
    ):
        self.mock_cloudbuild_client(fake_cloudbuild_client, Build.Status(Build.Status.SUCCESS))
        self.mock_kms_client(fake_kms_client)
        self.mock_max_retries(fake_cloudbuild_client, fake_kms_client)

        self.mock_message_builder(fake_message_builder)
        mock_invalid_finding(self.storage, self.uuid)
        org_count = Organization.objects.filter(slug__startswith="testing").count()

        with BurstTaskRunner() as burst:
            uploading_start(self.relocation.uuid, None, None)

            with patch.object(
                LostPasswordHash, "send_relocate_account_email"
            ) as mock_relocation_email:
                burst()

            assert mock_relocation_email.call_count == 0

        assert fake_cloudbuild_client.create_build.call_count == MAX_FAST_TASK_ATTEMPTS
        assert fake_cloudbuild_client.get_build.call_count == MAX_VALIDATION_POLL_ATTEMPTS

        assert fake_kms_client.asymmetric_decrypt.call_count == MAX_FAST_TASK_ATTEMPTS
        assert fake_kms_client.get_public_key.call_count == 2 * MAX_FAST_TASK_ATTEMPTS

        assert fake_message_builder.call_count == 2
        email_types = [args.kwargs["type"] for args in fake_message_builder.call_args_list]
        assert "relocation.started" in email_types
        assert "relocation.failed" in email_types
        assert "relocation.succeeded" not in email_types

        assert relocated_signal_mock.call_count == 0
        assert relocation_redeem_promo_code_signal_mock.call_count == 0

        relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.status == Relocation.Status.FAILURE.value
        assert relocation.latest_notified == Relocation.EmailKind.FAILED.value
        assert relocation.failure_reason

        self.assert_failure_database_state(org_count)
        analytics_record_mock.assert_not_called()
