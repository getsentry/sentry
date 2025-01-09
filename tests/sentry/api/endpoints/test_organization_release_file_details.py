from base64 import urlsafe_b64encode

from django.urls import reverse

from sentry.models.distribution import Distribution
from sentry.models.files.file import File
from sentry.models.release import Release
from sentry.models.releasefile import ReleaseFile
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.response import close_streaming_response


class ReleaseFileDetailsTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        project = self.create_project(name="foo")

        release = Release.objects.create(organization_id=project.organization_id, version="1")
        release.add_project(project)

        releasefile = ReleaseFile.objects.create(
            organization_id=project.organization_id,
            release_id=release.id,
            file=File.objects.create(name="application.js", type="release.file"),
            name="http://example.com/application.js",
        )

        url = reverse(
            "sentry-api-0-organization-release-file-details",
            kwargs={
                "organization_id_or_slug": project.organization.slug,
                "version": release.version,
                "file_id": releasefile.id,
            },
        )

        response = self.client.get(url)

        assert response.status_code == 200, response.content
        assert response.data["id"] == str(releasefile.id)

    def test_file_download(self):
        self.login_as(user=self.user)

        project = self.create_project(name="foo")

        release = Release.objects.create(organization_id=project.organization_id, version="1")
        release.add_project(project)

        from io import BytesIO

        f = File.objects.create(name="applications.js", type="release.file")
        f.putfile(BytesIO(b"File contents here"))

        releasefile = ReleaseFile.objects.create(
            organization_id=project.organization_id,
            project_id=project.id,
            release_id=release.id,
            file=f,
            name="  http://example.com/appli\n\rcatios n.js\n\n\r  ",
        )

        url = reverse(
            "sentry-api-0-organization-release-file-details",
            kwargs={
                "organization_id_or_slug": project.organization.slug,
                "version": release.version,
                "file_id": releasefile.id,
            },
        )

        response = self.client.get(url + "?download=1")
        assert response.status_code == 200, response.content
        assert response.get("Content-Disposition") == 'attachment; filename="appli catios n.js"'
        assert response.get("Content-Length") == str(f.size)
        assert response.get("Content-Type") == "application/octet-stream"
        assert b"File contents here" == close_streaming_response(response)

        user_no_permission = self.create_user("baz@localhost", username="baz")
        self.login_as(user=user_no_permission)
        response = self.client.get(url + "?download=1")
        assert response.status_code == 403, response.content

    def _get(self, file_id):
        url = reverse(
            "sentry-api-0-organization-release-file-details",
            kwargs={
                "organization_id_or_slug": self.project.organization.slug,
                "version": self.release.version,
                "file_id": file_id,
            },
        )

        return self.client.get(url)

    def test_invalid_id(self):
        self.login_as(user=self.user)
        response = self._get("foo666")
        assert response.status_code == 404, response.content

    def test_archived(self):
        self.login_as(user=self.user)
        self.create_release_archive()
        id = urlsafe_b64encode(b"_~/index.js")
        response = self._get(id.decode())
        assert response.status_code == 200
        assert response.data["id"] == id

    def test_archived_with_dist(self):
        self.login_as(user=self.user)
        dist = Distribution.objects.create(
            organization_id=self.organization.id, release_id=self.release.id, name="foo"
        )
        self.create_release_archive(dist=dist)
        id = urlsafe_b64encode(b"foo_~/index.js")
        response = self._get(id.decode())
        assert response.status_code == 200
        assert response.data["id"] == id


class ReleaseFileUpdateTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        project = self.create_project(name="foo")

        release = Release.objects.create(organization_id=project.organization_id, version="1")
        release.add_project(project)

        releasefile = ReleaseFile.objects.create(
            organization_id=project.organization_id,
            release_id=release.id,
            file=File.objects.create(name="application.js", type="release.file"),
            name="http://example.com/application.js",
        )

        url = reverse(
            "sentry-api-0-organization-release-file-details",
            kwargs={
                "organization_id_or_slug": project.organization.slug,
                "version": release.version,
                "file_id": releasefile.id,
            },
        )

        response = self.client.put(url, {"name": "foobar"})

        assert response.status_code == 200, response.content
        assert response.data["id"] == str(releasefile.id)

        releasefile = ReleaseFile.objects.get(id=releasefile.id)
        assert releasefile.name == "foobar"
        assert releasefile.ident == ReleaseFile.get_ident("foobar")


class ReleaseFileDeleteTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        project = self.create_project(name="foo")

        release = Release.objects.create(organization_id=project.organization_id, version="1")
        release.add_project(project)

        assert release.count_artifacts() == 0

        releasefile = ReleaseFile.objects.create(
            organization_id=project.organization_id,
            release_id=release.id,
            file=File.objects.create(name="application.js", type="release.file"),
            name="http://example.com/application.js",
        )

        assert release.count_artifacts() == 1

        url = reverse(
            "sentry-api-0-organization-release-file-details",
            kwargs={
                "organization_id_or_slug": project.organization.slug,
                "version": release.version,
                "file_id": releasefile.id,
            },
        )

        response = self.client.delete(url)

        assert response.status_code == 204, response.content

        assert not ReleaseFile.objects.filter(id=releasefile.id).exists()
        assert not File.objects.filter(id=releasefile.file.id).exists()
        assert release.count_artifacts() == 0
