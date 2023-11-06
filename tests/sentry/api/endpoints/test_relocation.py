import tempfile
from pathlib import Path
from typing import Tuple

from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse

from sentry.backup.helpers import create_encrypted_export_tarball
from sentry.models.relocation import Relocation, RelocationFile
from sentry.testutils.cases import APITestCase
from sentry.testutils.factories import get_fixture_path
from sentry.testutils.helpers.backups import generate_rsa_key_pair
from sentry.testutils.silo import region_silo_test
from sentry.utils import json

FRESH_INSTALL_PATH = get_fixture_path("backup", "fresh-install.json")


@region_silo_test
class RelocationCreateTest(APITestCase):
    endpoint = "sentry-api-0-relocation"

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

    def test_success_simple(self):
        relocation_count = Relocation.objects.count()
        relocation_file_count = RelocationFile.objects.count()

        with tempfile.TemporaryDirectory() as tmp_dir:
            (_, tmp_pub_key_path) = self.tmp_keys(tmp_dir)
            with self.feature("relocation:enabled"), open(FRESH_INSTALL_PATH) as f:
                data = json.load(f)
                with open(tmp_pub_key_path, "rb") as p:
                    url = reverse("sentry-api-0-relocation")
                    response = self.client.post(
                        url,
                        {
                            "owner": self.owner.username,
                            "file": SimpleUploadedFile(
                                "export.tar",
                                create_encrypted_export_tarball(data, p).getvalue(),
                                content_type="application/tar",
                            ),
                            "orgs": ["testing", "foo"],
                        },
                        format="multipart",
                    )

        assert response.status_code == 201
        assert Relocation.objects.count() == relocation_count + 1
        assert RelocationFile.objects.count() == relocation_file_count + 1

    def test_success_relocation_for_same_owner_already_completed(self):
        Relocation.objects.create(
            creator=self.superuser.id,
            owner=self.owner.id,
            want_org_slugs=["not-relevant-to-this-test"],
            step=Relocation.Step.COMPLETED.value,
            status=Relocation.Status.FAILURE.value,
        )
        Relocation.objects.create(
            creator=self.superuser.id,
            owner=self.owner.id,
            want_org_slugs=["not-relevant-to-this-test"],
            step=Relocation.Step.COMPLETED.value,
            status=Relocation.Status.SUCCESS.value,
        )
        relocation_count = Relocation.objects.count()
        relocation_file_count = RelocationFile.objects.count()

        with tempfile.TemporaryDirectory() as tmp_dir:
            (_, tmp_pub_key_path) = self.tmp_keys(tmp_dir)
            with self.feature("relocation:enabled"), open(FRESH_INSTALL_PATH) as f:
                data = json.load(f)
                with open(tmp_pub_key_path, "rb") as p:
                    url = reverse("sentry-api-0-relocation")
                    response = self.client.post(
                        url,
                        {
                            "owner": self.owner.username,
                            "file": SimpleUploadedFile(
                                "export.tar",
                                create_encrypted_export_tarball(data, p).getvalue(),
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
                    url = reverse("sentry-api-0-relocation")
                    response = self.client.post(
                        url,
                        {
                            "owner": self.owner.username,
                            "file": SimpleUploadedFile(
                                "export.tar",
                                create_encrypted_export_tarball(data, p).getvalue(),
                                content_type="application/tar",
                            ),
                            "orgs": ["testing", "foo"],
                        },
                        format="multipart",
                    )

        assert response.status_code == 400

    def test_fail_missing_file(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            (_, tmp_pub_key_path) = self.tmp_keys(tmp_dir)
            with self.feature("relocation:enabled"):
                url = reverse("sentry-api-0-relocation")
                response = self.client.post(
                    url,
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
            with self.feature("relocation:enabled"), open(FRESH_INSTALL_PATH) as f:
                data = json.load(f)
                with open(tmp_pub_key_path, "rb") as p:
                    url = reverse("sentry-api-0-relocation")
                    response = self.client.post(
                        url,
                        {
                            "owner": self.owner.username,
                            "file": SimpleUploadedFile(
                                "export.tar",
                                create_encrypted_export_tarball(data, p).getvalue(),
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
            with self.feature("relocation:enabled"), open(FRESH_INSTALL_PATH) as f:
                data = json.load(f)
                with open(tmp_pub_key_path, "rb") as p:
                    url = reverse("sentry-api-0-relocation")
                    response = self.client.post(
                        url,
                        {
                            "file": SimpleUploadedFile(
                                "export.tar",
                                create_encrypted_export_tarball(data, p).getvalue(),
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
            with self.feature("relocation:enabled"), open(FRESH_INSTALL_PATH) as f:
                data = json.load(f)
                with open(tmp_pub_key_path, "rb") as p:
                    url = reverse("sentry-api-0-relocation")
                    response = self.client.post(
                        url,
                        {
                            "owner": "doesnotexist",
                            "file": SimpleUploadedFile(
                                "export.tar",
                                create_encrypted_export_tarball(data, p).getvalue(),
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
            creator=self.superuser.id,
            owner=self.owner.id,
            want_org_slugs=["not-relevant-to-this-test"],
            step=Relocation.Step.UPLOADING.value,
        )

        with tempfile.TemporaryDirectory() as tmp_dir:
            (_, tmp_pub_key_path) = self.tmp_keys(tmp_dir)
            with self.feature("relocation:enabled"), open(FRESH_INSTALL_PATH) as f:
                data = json.load(f)
                with open(tmp_pub_key_path, "rb") as p:
                    url = reverse("sentry-api-0-relocation")
                    simple_file = SimpleUploadedFile(
                        "export.tar",
                        create_encrypted_export_tarball(data, p).getvalue(),
                        content_type="application/tar",
                    )
                    simple_file.name = None
                    response = self.client.post(
                        url,
                        {
                            "owner": self.owner.username,
                            "file": simple_file,
                            "orgs": ["testing", "foo"],
                        },
                        format="multipart",
                    )

        assert response.status_code == 409
