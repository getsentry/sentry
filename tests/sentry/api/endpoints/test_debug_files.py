from __future__ import absolute_import

import zipfile
from uuid import uuid4
from six import BytesIO, text_type

from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.urlresolvers import reverse

from sentry.testutils import APITestCase
from sentry.models import ProjectDebugFile, Release, ReleaseFile, File

# This is obviously a freely generated UUID and not the checksum UUID.
# This is permissible if users want to send different UUIDs
PROGUARD_UUID = "6dc7fdb0-d2fb-4c8e-9d6b-bb1aa98929b1"
PROGUARD_SOURCE = b"""\
org.slf4j.helpers.Util$ClassContextSecurityManager -> org.a.b.g$a:
65:65:void <init>() -> <init>
67:67:java.lang.Class[] getClassContext() -> getClassContext
65:65:void <init>(org.slf4j.helpers.Util$1) -> <init>
"""


class DebugFilesUploadTest(APITestCase):
    def _upload_proguard(self, url, uuid):
        out = BytesIO()
        f = zipfile.ZipFile(out, "w")
        f.writestr("proguard/%s.txt" % uuid, PROGUARD_SOURCE)
        f.close()

        return self.client.post(
            url,
            {
                "file": SimpleUploadedFile(
                    "symbols.zip", out.getvalue(), content_type="application/zip"
                )
            },
            format="multipart",
        )

    def test_simple_proguard_upload(self):
        project = self.create_project(name="foo")

        url = reverse(
            "sentry-api-0-dsym-files",
            kwargs={"organization_slug": project.organization.slug, "project_slug": project.slug},
        )

        self.login_as(user=self.user)

        response = self._upload_proguard(url, PROGUARD_UUID)

        assert response.status_code == 201, response.content
        assert len(response.data) == 1
        assert response.data[0]["headers"] == {"Content-Type": "text/x-proguard+plain"}
        assert response.data[0]["sha1"] == "e6d3c5185dac63eddfdc1a5edfffa32d46103b44"
        assert response.data[0]["uuid"] == PROGUARD_UUID
        assert response.data[0]["objectName"] == "proguard-mapping"
        assert response.data[0]["cpuName"] == "any"
        assert response.data[0]["symbolType"] == "proguard"

    def test_associate_proguard_dsym(self):
        project = self.create_project(name="foo")

        url = reverse(
            "sentry-api-0-dsym-files",
            kwargs={"organization_slug": project.organization.slug, "project_slug": project.slug},
        )

        self.login_as(user=self.user)

        response = self._upload_proguard(url, PROGUARD_UUID)

        assert response.status_code == 201, response.content
        assert len(response.data) == 1
        assert response.data[0]["headers"] == {"Content-Type": "text/x-proguard+plain"}
        assert response.data[0]["sha1"] == "e6d3c5185dac63eddfdc1a5edfffa32d46103b44"
        assert response.data[0]["uuid"] == PROGUARD_UUID
        assert response.data[0]["objectName"] == "proguard-mapping"
        assert response.data[0]["cpuName"] == "any"
        assert response.data[0]["symbolType"] == "proguard"

        url = reverse(
            "sentry-api-0-associate-dsym-files",
            kwargs={"organization_slug": project.organization.slug, "project_slug": project.slug},
        )

        response = self.client.post(
            url,
            {
                "checksums": ["e6d3c5185dac63eddfdc1a5edfffa32d46103b44"],
                "platform": "android",
                "name": "MyApp",
                "appId": "com.example.myapp",
                "version": "1.0",
                "build": "1",
            },
            format="json",
        )

        assert response.status_code == 200, response.content
        assert "associatedDsymFiles" in response.data
        assert response.data["associatedDsymFiles"] == []

    def test_associate_proguard_dsym_no_build(self):
        project = self.create_project(name="foo")

        url = reverse(
            "sentry-api-0-dsym-files",
            kwargs={"organization_slug": project.organization.slug, "project_slug": project.slug},
        )

        self.login_as(user=self.user)

        response = self._upload_proguard(url, PROGUARD_UUID)

        assert response.status_code == 201, response.content
        assert len(response.data) == 1
        assert response.data[0]["headers"] == {"Content-Type": "text/x-proguard+plain"}
        assert response.data[0]["sha1"] == "e6d3c5185dac63eddfdc1a5edfffa32d46103b44"
        assert response.data[0]["uuid"] == PROGUARD_UUID
        assert response.data[0]["objectName"] == "proguard-mapping"
        assert response.data[0]["cpuName"] == "any"
        assert response.data[0]["symbolType"] == "proguard"

        url = reverse(
            "sentry-api-0-associate-dsym-files",
            kwargs={"organization_slug": project.organization.slug, "project_slug": project.slug},
        )

        response = self.client.post(
            url,
            {
                "checksums": ["e6d3c5185dac63eddfdc1a5edfffa32d46103b44"],
                "platform": "android",
                "name": "MyApp",
                "appId": "com.example.myapp",
                "version": "1.0",
            },
            format="json",
        )

        assert response.status_code == 200, response.content
        assert "associatedDsymFiles" in response.data
        assert response.data["associatedDsymFiles"] == []

    def test_dsyms_requests(self):
        project = self.create_project(name="foo")

        url = reverse(
            "sentry-api-0-dsym-files",
            kwargs={"organization_slug": project.organization.slug, "project_slug": project.slug},
        )

        self.login_as(user=self.user)

        response = self._upload_proguard(url, PROGUARD_UUID)

        assert response.status_code == 201, response.content
        assert len(response.data) == 1

        url = reverse(
            "sentry-api-0-associate-dsym-files",
            kwargs={"organization_slug": project.organization.slug, "project_slug": project.slug},
        )

        response = self.client.post(
            url,
            {
                "checksums": ["e6d3c5185dac63eddfdc1a5edfffa32d46103b44"],
                "platform": "android",
                "name": "MyApp",
                "appId": "com.example.myapp",
                "version": "1.0",
                "build": "1",
            },
            format="json",
        )

        assert response.status_code == 200, response.content
        assert "associatedDsymFiles" in response.data
        assert response.data["associatedDsymFiles"] == []

        url = reverse(
            "sentry-api-0-dsym-files",
            kwargs={"organization_slug": project.organization.slug, "project_slug": project.slug},
        )

        response = self.client.get(url)

        assert response.status_code == 200, response.content

        (dsym,) = response.data
        assert dsym["cpuName"] == "any"
        assert dsym["headers"] == {"Content-Type": "text/x-proguard+plain"}
        assert dsym["objectName"] == "proguard-mapping"
        assert dsym["sha1"] == "e6d3c5185dac63eddfdc1a5edfffa32d46103b44"
        assert dsym["symbolType"] == "proguard"
        assert dsym["uuid"] == "6dc7fdb0-d2fb-4c8e-9d6b-bb1aa98929b1"
        download_id = dsym["id"]

        # Test download
        response = self.client.get(url + "?id=" + download_id)

        assert response.status_code == 200, response.content
        assert (
            response.get("Content-Disposition")
            == 'attachment; filename="' + PROGUARD_UUID + '.txt"'
        )
        assert response.get("Content-Length") == text_type(len(PROGUARD_SOURCE))
        assert response.get("Content-Type") == "application/octet-stream"
        assert PROGUARD_SOURCE == BytesIO(b"".join(response.streaming_content)).getvalue()

        # Login user with no permissions
        user_no_permission = self.create_user("baz@localhost", username="baz")
        self.login_as(user=user_no_permission)
        response = self.client.get(url + "?id=" + download_id)
        assert response.status_code == 403, response.content

        # Try to delete with no permissions
        response = self.client.delete(url + "?id=" + download_id)
        assert response.status_code == 403, response.content

        # Login again with permissions
        self.login_as(user=self.user)

        response = self.client.delete(url + "?id=888")
        assert response.status_code == 404, response.content

        assert ProjectDebugFile.objects.count() == 1

        response = self.client.delete(url + "?id=" + download_id)
        assert response.status_code == 204, response.content

        assert ProjectDebugFile.objects.count() == 0

    def test_dsyms_search(self):
        project = self.create_project(name="foo")

        url = reverse(
            "sentry-api-0-dsym-files",
            kwargs={"organization_slug": project.organization.slug, "project_slug": project.slug},
        )

        self.login_as(user=self.user)

        first_uuid = None
        last_uuid = None
        for i in range(25):
            last_uuid = text_type(uuid4())
            if first_uuid is None:
                first_uuid = last_uuid
            self._upload_proguard(url, last_uuid)

        # Test max 20 per page
        response = self.client.get(url)
        assert response.status_code == 200, response.content
        dsyms = response.data
        assert len(dsyms) == 20

        # Test should return last
        response = self.client.get(url + "?query=" + last_uuid)
        assert response.status_code == 200, response.content
        dsyms = response.data
        assert len(dsyms) == 1

        response = self.client.get(url + "?query=proguard")
        assert response.status_code == 200, response.content
        dsyms = response.data
        assert len(dsyms) == 20

    def test_source_maps(self):
        project = self.create_project(name="foo")

        release = Release.objects.create(organization_id=project.organization_id, version="1")
        release2 = Release.objects.create(organization_id=project.organization_id, version="2")
        release.add_project(project)
        release2.add_project(project)

        ReleaseFile.objects.create(
            organization_id=project.organization_id,
            release=release,
            file=File.objects.create(name="application.js", type="release.file"),
            name="http://example.com/application.js",
        )
        ReleaseFile.objects.create(
            organization_id=project.organization_id,
            release=release,
            file=File.objects.create(name="application2.js", type="release.file"),
            name="http://example.com/application2.js",
        )

        url = reverse(
            "sentry-api-0-source-maps",
            kwargs={"organization_slug": project.organization.slug, "project_slug": project.slug},
        )

        self.login_as(user=self.user)

        response = self.client.get(url)

        assert response.status_code == 200, response.content
        assert len(response.data) == 2
        assert response.data[0]["name"] == text_type(release2.version)
        assert response.data[0]["fileCount"] == 0
        assert response.data[1]["fileCount"] == 2

    def test_source_maps_delete_archive(self):
        project = self.create_project(name="foo")

        release = Release.objects.create(
            organization_id=project.organization_id, version="1", id="1"
        )
        release.add_project(project)

        ReleaseFile.objects.create(
            organization_id=project.organization_id,
            release=release,
            file=File.objects.create(name="application.js", type="release.file"),
            name="http://example.com/application.js",
        )

        url = reverse(
            "sentry-api-0-source-maps",
            kwargs={"organization_slug": project.organization.slug, "project_slug": project.slug},
        )

        self.login_as(user=self.user)

        response = self.client.delete(url + "?name=1")
        assert response.status_code == 204
        assert not ReleaseFile.objects.filter(release=release).exists()
