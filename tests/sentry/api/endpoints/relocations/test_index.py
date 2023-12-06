import tempfile
from datetime import timedelta
from pathlib import Path
from typing import Tuple
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse

from sentry.api.endpoints.relocations import ERR_FEATURE_DISABLED
from sentry.backup.helpers import LocalFileEncryptor, create_encrypted_export_tarball
from sentry.models.relocation import Relocation, RelocationFile
from sentry.testutils.cases import APITestCase
from sentry.testutils.factories import get_fixture_path
from sentry.testutils.helpers.backups import generate_rsa_key_pair
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.silo import region_silo_test
from sentry.utils import json

FRESH_INSTALL_PATH = get_fixture_path("backup", "fresh-install.json")


@region_silo_test
class RelocationCreateTest(APITestCase):
    endpoint = "sentry-api-0-relocations-index"

    def setUp(self):
        super().setUp()
        self.owner = self.create_user(
            email="owner", is_superuser=False, is_staff=True, is_active=True
        )
        self.superuser = self.create_user(
            "superuser", is_superuser=True, is_staff=True, is_active=True
        )
        self.login_as(user=self.superuser, superuser=True)

    def tmp_keys(self, tmp_dir: str) -> Tuple[Path, Path]:
        (priv_key_pem, pub_key_pem) = generate_rsa_key_pair()
        tmp_priv_key_path = Path(tmp_dir).joinpath("key")
        with open(tmp_priv_key_path, "wb") as f:
            f.write(priv_key_pem)

        tmp_pub_key_path = Path(tmp_dir).joinpath("key.pub")
        with open(tmp_pub_key_path, "wb") as f:
            f.write(pub_key_pem)

        return (tmp_priv_key_path, tmp_pub_key_path)

    @patch("sentry.tasks.relocation.uploading_complete.delay")
    def test_success_simple(self, uploading_complete_mock):
        relocation_count = Relocation.objects.count()
        relocation_file_count = RelocationFile.objects.count()

        with tempfile.TemporaryDirectory() as tmp_dir:
            (_, tmp_pub_key_path) = self.tmp_keys(tmp_dir)
            with self.options(
                {
                    "relocation.enabled": True,
                    "relocation.daily-limit-small": 1,
                }
            ), open(FRESH_INSTALL_PATH) as f:
                data = json.load(f)
                with open(tmp_pub_key_path, "rb") as p:
                    response = self.client.post(
                        reverse(self.endpoint),
                        {
                            "owner": self.owner.username,
                            "file": SimpleUploadedFile(
                                "export.tar",
                                create_encrypted_export_tarball(
                                    data, LocalFileEncryptor(p)
                                ).getvalue(),
                                content_type="application/tar",
                            ),
                            "orgs": ["testing", "foo"],
                        },
                        format="multipart",
                    )

        assert response.status_code == 201
        assert Relocation.objects.count() == relocation_count + 1
        assert RelocationFile.objects.count() == relocation_file_count + 1
        assert uploading_complete_mock.call_count == 1

    def test_success_relocation_for_same_owner_already_completed(self):
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
            with self.options(
                {
                    "relocation.enabled": True,
                    "relocation.daily-limit-small": 1,
                }
            ), open(FRESH_INSTALL_PATH) as f:
                data = json.load(f)
                with open(tmp_pub_key_path, "rb") as p:
                    response = self.client.post(
                        reverse(self.endpoint),
                        {
                            "owner": self.owner.username,
                            "file": SimpleUploadedFile(
                                "export.tar",
                                create_encrypted_export_tarball(
                                    data, LocalFileEncryptor(p)
                                ).getvalue(),
                                content_type="application/tar",
                            ),
                            "orgs": ["testing", "foo"],
                        },
                        format="multipart",
                    )

        assert response.status_code == 201
        assert Relocation.objects.count() == relocation_count + 1
        assert RelocationFile.objects.count() == relocation_file_count + 1

    def test_fail_feature_disabled(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            (_, tmp_pub_key_path) = self.tmp_keys(tmp_dir)
            with open(FRESH_INSTALL_PATH) as f:
                data = json.load(f)
                with open(tmp_pub_key_path, "rb") as p:
                    response = self.client.post(
                        reverse(self.endpoint),
                        {
                            "owner": self.owner.username,
                            "file": SimpleUploadedFile(
                                "export.tar",
                                create_encrypted_export_tarball(
                                    data, LocalFileEncryptor(p)
                                ).getvalue(),
                                content_type="application/tar",
                            ),
                            "orgs": ["testing", "foo"],
                        },
                        format="multipart",
                    )

        assert response.status_code == 400
        assert response.data.get("detail") is not None
        assert response.data.get("detail") == ERR_FEATURE_DISABLED

    def test_fail_missing_file(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            (_, tmp_pub_key_path) = self.tmp_keys(tmp_dir)
            with self.options(
                {
                    "relocation.enabled": True,
                    "relocation.daily-limit-small": 1,
                }
            ):
                response = self.client.post(
                    reverse(self.endpoint),
                    {
                        "owner": self.owner.username,
                        "orgs": ["testing", "foo"],
                    },
                    format="multipart",
                )

        assert response.status_code == 400
        assert response.data.get("file") is not None
        assert response.data.get("file")[0].code == "required"

    def test_fail_missing_orgs(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            (_, tmp_pub_key_path) = self.tmp_keys(tmp_dir)
            with self.options(
                {
                    "relocation.enabled": True,
                    "relocation.daily-limit-small": 1,
                }
            ), open(FRESH_INSTALL_PATH) as f:
                data = json.load(f)
                with open(tmp_pub_key_path, "rb") as p:
                    response = self.client.post(
                        reverse(self.endpoint),
                        {
                            "owner": self.owner.username,
                            "file": SimpleUploadedFile(
                                "export.tar",
                                create_encrypted_export_tarball(
                                    data, LocalFileEncryptor(p)
                                ).getvalue(),
                                content_type="application/tar",
                            ),
                        },
                        format="multipart",
                    )

        assert response.status_code == 400
        assert response.data.get("orgs") is not None
        assert response.data.get("orgs")[0].code == "required"

    def test_fail_missing_owner(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            (_, tmp_pub_key_path) = self.tmp_keys(tmp_dir)
            with self.options(
                {
                    "relocation.enabled": True,
                    "relocation.daily-limit-small": 1,
                }
            ), open(FRESH_INSTALL_PATH) as f:
                data = json.load(f)
                with open(tmp_pub_key_path, "rb") as p:
                    response = self.client.post(
                        reverse(self.endpoint),
                        {
                            "file": SimpleUploadedFile(
                                "export.tar",
                                create_encrypted_export_tarball(
                                    data, LocalFileEncryptor(p)
                                ).getvalue(),
                                content_type="application/tar",
                            ),
                            "orgs": ["testing", "foo"],
                        },
                        format="multipart",
                    )

        assert response.status_code == 400
        assert response.data.get("owner") is not None
        assert response.data.get("owner")[0].code == "required"

    def test_fail_nonexistent_owner(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            (_, tmp_pub_key_path) = self.tmp_keys(tmp_dir)
            with self.options(
                {
                    "relocation.enabled": True,
                    "relocation.daily-limit-small": 1,
                }
            ), open(FRESH_INSTALL_PATH) as f:
                data = json.load(f)
                with open(tmp_pub_key_path, "rb") as p:
                    response = self.client.post(
                        reverse(self.endpoint),
                        {
                            "owner": "doesnotexist",
                            "file": SimpleUploadedFile(
                                "export.tar",
                                create_encrypted_export_tarball(
                                    data, LocalFileEncryptor(p)
                                ).getvalue(),
                                content_type="application/tar",
                            ),
                            "orgs": ["testing", "foo"],
                        },
                        format="multipart",
                    )

        assert response.status_code == 400
        assert response.data.get("detail") is not None
        assert "`doesnotexist`" in response.data.get("detail")

    def test_fail_relocation_for_same_owner_already_in_progress(self):
        Relocation.objects.create(
            creator_id=self.superuser.id,
            owner_id=self.owner.id,
            want_org_slugs=["not-relevant-to-this-test"],
            step=Relocation.Step.UPLOADING.value,
        )

        with tempfile.TemporaryDirectory() as tmp_dir:
            (_, tmp_pub_key_path) = self.tmp_keys(tmp_dir)
            with self.options(
                {
                    "relocation.enabled": True,
                    "relocation.daily-limit-small": 1,
                }
            ), open(FRESH_INSTALL_PATH) as f:
                data = json.load(f)
                with open(tmp_pub_key_path, "rb") as p:
                    simple_file = SimpleUploadedFile(
                        "export.tar",
                        create_encrypted_export_tarball(data, LocalFileEncryptor(p)).getvalue(),
                        content_type="application/tar",
                    )
                    simple_file.name = None
                    response = self.client.post(
                        reverse(self.endpoint),
                        {
                            "owner": self.owner.username,
                            "file": simple_file,
                            "orgs": ["testing", "foo"],
                        },
                        format="multipart",
                    )

        assert response.status_code == 409

    def test_fail_throttle_if_daily_limit_reached(self):
        relocation_count = Relocation.objects.count()
        relocation_file_count = RelocationFile.objects.count()

        with tempfile.TemporaryDirectory() as tmp_dir:
            (_, tmp_pub_key_path) = self.tmp_keys(tmp_dir)
            with self.options(
                {
                    "relocation.enabled": True,
                    "relocation.daily-limit-small": 1,
                }
            ), open(FRESH_INSTALL_PATH) as f:
                data = json.load(f)
                with open(tmp_pub_key_path, "rb") as p:
                    initial_response = self.client.post(
                        reverse(self.endpoint),
                        {
                            "owner": self.owner.username,
                            "file": SimpleUploadedFile(
                                "export.tar",
                                create_encrypted_export_tarball(
                                    data, LocalFileEncryptor(p)
                                ).getvalue(),
                                content_type="application/tar",
                            ),
                            "orgs": ["testing", "foo"],
                        },
                        format="multipart",
                    )

                    # Simulate completion of relocation job
                    relocation = Relocation.objects.all()[0]
                    relocation.status = Relocation.Status.SUCCESS.value
                    relocation.save()
                    relocation.refresh_from_db()

                with open(tmp_pub_key_path, "rb") as p:
                    throttled_response = self.client.post(
                        reverse(self.endpoint),
                        {
                            "owner": self.owner.username,
                            "file": SimpleUploadedFile(
                                "export.tar",
                                create_encrypted_export_tarball(
                                    data, LocalFileEncryptor(p)
                                ).getvalue(),
                                content_type="application/tar",
                            ),
                            "orgs": ["testing", "foo"],
                        },
                        format="multipart",
                    )

        assert initial_response.status_code == 201
        assert throttled_response.status_code == 429
        assert throttled_response.data.get("detail") is not None
        assert (
            throttled_response.data.get("detail")
            == "We've reached our daily limit of relocations - please try again tomorrow or contact support."
        )
        assert Relocation.objects.count() == relocation_count + 1
        assert RelocationFile.objects.count() == relocation_file_count + 1

    def test_success_no_throttle_different_bucket_relocations(self):
        relocation_count = Relocation.objects.count()
        relocation_file_count = RelocationFile.objects.count()

        with tempfile.TemporaryDirectory() as tmp_dir:
            (_, tmp_pub_key_path) = self.tmp_keys(tmp_dir)
            with self.options(
                {
                    "relocation.enabled": True,
                    "relocation.daily-limit-small": 1,
                    "relocation.daily-limit-medium": 1,
                }
            ), open(FRESH_INSTALL_PATH) as f:
                data = json.load(f)
                with open(tmp_pub_key_path, "rb") as p:
                    initial_response = self.client.post(
                        reverse(self.endpoint),
                        {
                            "owner": self.owner.username,
                            "file": SimpleUploadedFile(
                                "export.tar",
                                create_encrypted_export_tarball(
                                    data, LocalFileEncryptor(p)
                                ).getvalue(),
                                content_type="application/tar",
                            ),
                            "orgs": ["testing", "foo"],
                        },
                        format="multipart",
                    )

                    # Simulate completion of relocation job
                    relocation = Relocation.objects.all()[0]
                    relocation.status = Relocation.Status.SUCCESS.value
                    relocation.save()
                    relocation.refresh_from_db()

                with open(tmp_pub_key_path, "rb") as p:
                    throttled_response = self.client.post(
                        reverse(self.endpoint),
                        {
                            "owner": self.owner.username,
                            "file": SimpleUploadedFile(
                                "export.tar",
                                create_encrypted_export_tarball(
                                    data, LocalFileEncryptor(p)
                                ).getvalue()
                                * 1000,
                                content_type="application/tar",
                            ),
                            "orgs": ["testing", "foo"],
                        },
                        format="multipart",
                    )

        assert initial_response.status_code == 201
        assert throttled_response.status_code == 201
        assert Relocation.objects.count() == relocation_count + 2
        assert RelocationFile.objects.count() == relocation_file_count + 2

    def test_success_no_throttle_relocation_over_multiple_days(self):
        relocation_count = Relocation.objects.count()
        relocation_file_count = RelocationFile.objects.count()

        with tempfile.TemporaryDirectory() as tmp_dir:
            (_, tmp_pub_key_path) = self.tmp_keys(tmp_dir)
            with self.options(
                {
                    "relocation.enabled": True,
                    "relocation.daily-limit-small": 1,
                }
            ), open(FRESH_INSTALL_PATH) as f, freeze_time("2023-11-28 00:00:00") as frozen_time:
                data = json.load(f)
                with open(tmp_pub_key_path, "rb") as p:
                    initial_response = self.client.post(
                        reverse(self.endpoint),
                        {
                            "owner": self.owner.username,
                            "file": SimpleUploadedFile(
                                "export.tar",
                                create_encrypted_export_tarball(
                                    data, LocalFileEncryptor(p)
                                ).getvalue(),
                                content_type="application/tar",
                            ),
                            "orgs": ["testing", "foo"],
                        },
                        format="multipart",
                    )

                    # Simulate completion of relocation job
                    relocation = Relocation.objects.all()[0]
                    relocation.status = Relocation.Status.SUCCESS.value
                    relocation.save()
                    relocation.refresh_from_db()

                frozen_time.shift(timedelta(days=1, minutes=1))

                # Relogin since session has expired
                self.login_as(user=self.superuser, superuser=True)
                with open(tmp_pub_key_path, "rb") as p:
                    throttled_response = self.client.post(
                        reverse(self.endpoint),
                        {
                            "owner": self.owner.username,
                            "file": SimpleUploadedFile(
                                "export.tar",
                                create_encrypted_export_tarball(
                                    data, LocalFileEncryptor(p)
                                ).getvalue(),
                                content_type="application/tar",
                            ),
                            "orgs": ["testing", "foo"],
                        },
                        format="multipart",
                    )

        assert initial_response.status_code == 201
        assert throttled_response.status_code == 201
        assert Relocation.objects.count() == relocation_count + 2
        assert RelocationFile.objects.count() == relocation_file_count + 2
