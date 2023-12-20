import io
from base64 import urlsafe_b64decode, urlsafe_b64encode
from hashlib import sha1

from django.urls import reverse

from sentry.api.endpoints.project_release_file_details import (
    INVALID_UPDATE_MESSAGE,
    ClosesDependentFiles,
)
from sentry.models.distribution import Distribution
from sentry.models.files.file import File
from sentry.models.release import Release
from sentry.models.releasefile import ReleaseFile
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.response import close_streaming_response


def test_closes_depnedent_files_is_iterable():
    # django (but not django.test) requires a file response to be iterable
    f = ClosesDependentFiles(io.BytesIO(b"hello\nworld\n"))
    assert list(f) == [b"hello\n", b"world\n"]


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
            "sentry-api-0-project-release-file-details",
            kwargs={
                "organization_slug": project.organization.slug,
                "project_slug": project.slug,
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
            "sentry-api-0-project-release-file-details",
            kwargs={
                "organization_slug": project.organization.slug,
                "project_slug": project.slug,
                "version": release.version,
                "file_id": releasefile.id,
            },
        )

        # Download as a user with sufficient role
        self.organization.update_option("sentry:debug_files_role", "admin")
        user = self.create_user("baz@localhost")
        self.create_member(user=user, organization=project.organization, role="owner")
        self.login_as(user=user)

        response = self.client.get(url + "?download=1")
        assert response.status_code == 200, response.content
        assert response.get("Content-Disposition") == 'attachment; filename="appli catios n.js"'
        assert response.get("Content-Length") == str(f.size)
        assert response.get("Content-Type") == "application/octet-stream"
        assert b"File contents here" == close_streaming_response(response)

        # Download as a superuser
        self.login_as(user=self.user)
        response = self.client.get(url + "?download=1")
        assert response.get("Content-Type") == "application/octet-stream"
        assert b"File contents here" == close_streaming_response(response)

        # # Download as a user without sufficient role
        self.organization.update_option("sentry:debug_files_role", "owner")
        user_no_role = self.create_user("bar@localhost")
        self.create_member(user=user_no_role, organization=project.organization, role="member")
        self.login_as(user=user_no_role)
        response = self.client.get(url + "?download=1")
        assert response.status_code == 403, response.content

        # Download as a user with no permissions
        user_no_permission = self.create_user("baz@localhost", username="baz")
        self.login_as(user=user_no_permission)
        response = self.client.get(url + "?download=1")
        assert response.status_code == 403, response.content

    def _get(self, file_id, postfix=""):
        url = reverse(
            "sentry-api-0-project-release-file-details",
            kwargs={
                "organization_slug": self.project.organization.slug,
                "project_slug": self.project.slug,
                "version": self.release.version,
                "file_id": file_id,
            },
        )

        return self.client.get(url + postfix)

    def test_invalid_id(self):

        # Invalid base64
        self.login_as(user=self.user)
        response = self._get("foo666")
        assert response.status_code == 404, response.content

        # Valid base 64, but missing dist separator:
        response = self._get(urlsafe_b64encode(b"foo666").decode())
        assert response.status_code == 404, response.content

    def test_archived(self):
        self.login_as(user=self.user)
        self.create_release_archive()

        id = urlsafe_b64encode(b"_~/index.js")
        response = self._get(id.decode())
        assert response.status_code == 200
        assert response.data["id"] == id

        # Get a file with a nonexisting dist:
        id = urlsafe_b64encode(b"mydist_~/index.js")
        response = self._get(id.decode())
        assert response.status_code == 404

        # Get a file that does not exist in index:
        id = urlsafe_b64encode(b"_~/foobar.js")
        response = self._get(id.decode())
        assert response.status_code == 404

    def test_download_archived(self):
        self.login_as(user=self.user)
        self.create_release_archive()

        id = urlsafe_b64encode(b"_~/index.js").decode()
        response = self._get(id)
        checksum = response.data["sha1"]

        response = self._get(id, "?download=1")
        assert response.status_code == 200
        body = close_streaming_response(response)
        assert sha1(body).hexdigest() == checksum

    def test_archived_with_dist(self):
        self.login_as(user=self.user)
        dist = Distribution.objects.create(
            organization_id=self.organization.id, release_id=self.release.id, name="foo"
        )
        self.create_release_archive(dist=dist)
        id = urlsafe_b64encode(b"foo_~/index.js")
        response = self._get(id.decode())
        assert response.status_code == 200
        assert response.data["id"] == id, urlsafe_b64decode(response.data["id"])


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
            "sentry-api-0-project-release-file-details",
            kwargs={
                "organization_slug": project.organization.slug,
                "project_slug": project.slug,
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

    def test_update_archived(self):
        self.login_as(user=self.user)
        self.create_release_archive()

        id = urlsafe_b64encode(b"_~/index.js")

        url = reverse(
            "sentry-api-0-project-release-file-details",
            kwargs={
                "organization_slug": self.organization.slug,
                "project_slug": self.project.slug,
                "version": self.release.version,
                "file_id": id,
            },
        )

        response = self.client.put(url, {"name": "foobar"})
        assert response.status_code == 400
        assert response.data == {"detail": INVALID_UPDATE_MESSAGE}  # TODO: document this in apidocs


class ReleaseFileDeleteTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        project = self.create_project(name="foo")

        release = Release.objects.create(
            project_id=project.id, organization_id=project.organization_id, version="1"
        )
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
            "sentry-api-0-project-release-file-details",
            kwargs={
                "organization_slug": project.organization.slug,
                "project_slug": project.slug,
                "version": release.version,
                "file_id": releasefile.id,
            },
        )

        response = self.client.delete(url)

        assert response.status_code == 204, response.content

        assert not ReleaseFile.objects.filter(id=releasefile.id).exists()
        assert not File.objects.filter(id=releasefile.file.id).exists()
        assert release.count_artifacts() == 0

    def test_delete_archived(self):
        self.login_as(user=self.user)
        self.create_release_archive()

        assert self.release.count_artifacts() == 2

        url = lambda id: reverse(
            "sentry-api-0-project-release-file-details",
            kwargs={
                "organization_slug": self.organization.slug,
                "project_slug": self.project.slug,
                "version": self.release.version,
                "file_id": id,
            },
        )

        id = urlsafe_b64encode(b"_~/index.js")
        response = self.client.delete(url(id.decode()))
        assert response.status_code == 204
        assert self.release.count_artifacts() == 1

        response = self.client.delete(url(urlsafe_b64encode(b"invalid_id")))
        assert response.status_code == 404
        assert self.release.count_artifacts() == 1

        response = self.client.delete(url(urlsafe_b64encode(b"_~/does_not_exist.js")))
        assert response.status_code == 404
        assert self.release.count_artifacts() == 1
