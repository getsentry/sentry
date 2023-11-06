from functools import cached_property
from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import Mock, patch

import pytest

from sentry.backup.helpers import create_encrypted_export_tarball
from sentry.models.files.file import File
from sentry.models.relocation import Relocation, RelocationFile
from sentry.tasks.relocation import ERR_FILE_UPLOAD, MAX_FAST_TASK_RETRIES, uploading_complete
from sentry.testutils.cases import TestCase
from sentry.testutils.factories import get_fixture_path
from sentry.testutils.helpers.backups import generate_rsa_key_pair
from sentry.testutils.silo import region_silo_test
from sentry.utils import json
from sentry.utils.relocation import RELOCATION_FILE_TYPE


class RelocationTaskTestCase(TestCase):
    def setUp(self):
        super().setUp()
        self.owner = self.create_user(
            email="owner", is_superuser=False, is_staff=False, is_active=True
        )
        self.superuser = self.create_user(
            "superuser", is_superuser=True, is_staff=True, is_active=True
        )
        self.login_as(user=self.superuser, superuser=True)
        self.relocation: Relocation = Relocation.objects.create(
            creator=self.superuser.id,
            owner=self.owner.id,
            want_org_slugs=["testing"],
            step=Relocation.Step.UPLOADING.value,
        )
        self.relocation_file = RelocationFile.objects.create(
            relocation=self.relocation,
            file=self.file,
            kind=RelocationFile.Kind.RAW_USER_DATA.value,
        )
        self.uuid = self.relocation.uuid

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

            with open(get_fixture_path("backup", "fresh-install.json")) as f:
                data = json.load(f)
                with open(tmp_pub_key_path, "rb") as p:
                    file = File.objects.create(name="export.tar", type=RELOCATION_FILE_TYPE)
                    self.tarball = create_encrypted_export_tarball(data, p).getvalue()
                    file.putfile(BytesIO(self.tarball))

            return file


@patch("sentry.tasks.relocation.preprocessing_scan.delay")
@region_silo_test
class UploadingCompleteTest(RelocationTaskTestCase):
    def test_success(self, preprocessing_scan_mock: Mock):
        uploading_complete(self.relocation.uuid)

        assert preprocessing_scan_mock.call_count == 1

    def test_retry_if_attempts_left(self, preprocessing_scan_mock: Mock):
        RelocationFile.objects.filter(relocation=self.relocation).delete()

        # An exception being raised will trigger a retry in celery.
        with pytest.raises(Exception):
            uploading_complete(self.relocation.uuid)

        relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.status == Relocation.Status.IN_PROGRESS.value
        assert not relocation.failure_reason
        assert preprocessing_scan_mock.call_count == 0

    def test_fail_if_no_attempts_left(self, preprocessing_scan_mock: Mock):
        self.relocation.latest_task_attempts = MAX_FAST_TASK_RETRIES
        self.relocation.save()
        RelocationFile.objects.filter(relocation=self.relocation).delete()

        uploading_complete(self.relocation.uuid)

        relocation = Relocation.objects.get(uuid=self.uuid)
        assert relocation.status == Relocation.Status.FAILURE.value
        assert relocation.failure_reason == ERR_FILE_UPLOAD
        assert preprocessing_scan_mock.call_count == 0
