import uuid

from django.core.files.base import ContentFile
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse

from sentry.models.distribution import Distribution
from sentry.models.files.file import File
from sentry.models.release import Release
from sentry.models.releasefile import ARTIFACT_INDEX_FILENAME, ReleaseFile
from sentry.testutils.cases import APITestCase


class ReleaseFilesListTest(APITestCase):
    def test_simple(self):
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
            "sentry-api-0-project-release-files",
            kwargs={
                "organization_slug": project.organization.slug,
                "project_slug": project.slug,
                "version": release.version,
            },
        )

        self.login_as(user=self.user)

        response = self.client.get(url)

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(releasefile.id)

    def test_with_archive(self):
        project = self.project
        release = self.release
        self.login_as(user=self.user)
        url = reverse(
            "sentry-api-0-project-release-files",
            kwargs={
                "organization_slug": project.organization.slug,
                "project_slug": project.slug,
                "version": release.version,
            },
        )

        # Nothing there yet
        response = self.client.get(url)
        assert response.status_code == 200, response.content
        assert len(response.data) == 0

        def create_release_file(**kwargs):
            name = uuid.uuid4().hex
            return ReleaseFile.objects.create(
                organization_id=project.organization_id,
                release_id=release.id,
                file=File.objects.create(name=name, type="release.file"),
                name=name,
                **kwargs,
            )

        # artifact count of 0 is excluded
        create_release_file(artifact_count=0)
        response = self.client.get(url)
        assert response.status_code == 200, response.content
        assert len(response.data) == 0

        # artifact index without artifact_count is excluded
        self.create_release_archive()
        ReleaseFile.objects.get(release_id=release.id, name=ARTIFACT_INDEX_FILENAME).update(
            artifact_count=None
        )
        response = self.client.get(url)
        assert response.status_code == 200, response.content
        assert len(response.data) == 0

        # artifact index with artifact_count=0 is excluded
        ReleaseFile.objects.get(release_id=release.id, name=ARTIFACT_INDEX_FILENAME).update(
            artifact_count=0
        )
        response = self.client.get(url)
        assert response.status_code == 200, response.content
        assert len(response.data) == 0

        # artifact index with artifact_count is included
        ReleaseFile.objects.get(release_id=release.id, name=ARTIFACT_INDEX_FILENAME).update(
            artifact_count=42
        )
        response = self.client.get(url)
        assert response.status_code == 200, response.content
        assert len(response.data) == 2

        # Individual file with artifact_count=None is included
        create_release_file(artifact_count=None)
        response = self.client.get(url)
        assert response.status_code == 200, response.content
        assert len(response.data) == 3

        # Individual file with artifact_count=1 is included
        create_release_file(artifact_count=1)
        response = self.client.get(url)
        assert response.status_code == 200, response.content
        assert len(response.data) == 4

        # Additional dist is included
        self.create_release_archive(
            dist=Distribution.objects.create(
                organization_id=self.organization.id, release=release, name="foo"
            )
        )
        response = self.client.get(url)
        assert response.status_code == 200, response.content
        assert len(response.data) == 6

        # All returned objects have the same keys, regardless of their data source:
        assert all(data.keys() == response.data[0].keys() for data in response.data)

    def test_sort_order(self):
        self.login_as(user=self.user)
        url = reverse(
            "sentry-api-0-project-release-files",
            kwargs={
                "organization_slug": self.project.organization.slug,
                "project_slug": self.project.slug,
                "version": self.release.version,
            },
        )
        self.create_release_archive()
        response = self.client.get(url)
        assert response.status_code == 200, response.content
        assert len(response.data) == 2
        assert response.data[0]["name"] == "~/index.js"
        assert response.data[1]["name"] == "~/index.js.map"

    def test_archive_name_search(self):
        self.login_as(user=self.user)
        url = reverse(
            "sentry-api-0-project-release-files",
            kwargs={
                "organization_slug": self.project.organization.slug,
                "project_slug": self.project.slug,
                "version": self.release.version,
            },
        )
        self.create_release_archive()
        response = self.client.get(url + "?query=map")
        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["name"] == "~/index.js.map"

    def test_archive_checksum_search(self):
        self.login_as(user=self.user)
        url = reverse(
            "sentry-api-0-project-release-files",
            kwargs={
                "organization_slug": self.project.organization.slug,
                "project_slug": self.project.slug,
                "version": self.release.version,
            },
        )
        self.create_release_archive()

        response = self.client.get(url + "?checksum=3004341003e829253143f75eac9367167ef8d5ea")
        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["name"] == "~/index.js"

        response = self.client.get(url + "?checksum=4a1d80f5e1e09c9de78ca449b666e833193d84d7")
        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["name"] == "~/index.js.map"

        response = self.client.get(
            url
            + "?checksum=3004341003e829253143f75eac9367167ef8d5ea&checksum=4a1d80f5e1e09c9de78ca449b666e833193d84d7"
        )
        assert response.status_code == 200, response.content
        assert len(response.data) == 2
        assert response.data[0]["name"] == "~/index.js"
        assert response.data[1]["name"] == "~/index.js.map"

        response = self.client.get(url + "?checksum=0000111122223333444455556666777788889999")
        assert response.status_code == 200, response.content
        assert len(response.data) == 0

    def test_archive_queries_should_be_narrowing_search(self):
        self.login_as(user=self.user)
        url = reverse(
            "sentry-api-0-project-release-files",
            kwargs={
                "organization_slug": self.project.organization.slug,
                "project_slug": self.project.slug,
                "version": self.release.version,
            },
        )
        self.create_release_archive()

        # Found `index.js` and `index.js.map` by name, but only `index.js` by checksum.
        response = self.client.get(
            url + "?query=index&checksum=3004341003e829253143f75eac9367167ef8d5ea"
        )
        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["name"] == "~/index.js"

        # Found `index.js` and `index.js.map` by name, but nothing by checksum.
        response = self.client.get(
            url + "?query=index&checksum=0000111122223333444455556666777788889999"
        )
        assert response.status_code == 200, response.content
        assert len(response.data) == 0

    def test_archive_paging(self):
        self.login_as(user=self.user)
        url = reverse(
            "sentry-api-0-project-release-files",
            kwargs={
                "organization_slug": self.project.organization.slug,
                "project_slug": self.project.slug,
                "version": self.release.version,
            },
        )
        self.create_release_archive()
        response = self.client.get(url + "?cursor=0:1:0&per_page=1")
        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["name"] == "~/index.js"

        response = self.client.get(url + "?cursor=1:1:0&per_page=1")
        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["name"] == "~/index.js.map"


class ReleaseFileCreateTest(APITestCase):
    def test_simple(self):
        project = self.create_project(name="foo")

        release = Release.objects.create(organization_id=project.organization_id, version="1")
        release.add_project(project)

        assert release.count_artifacts() == 0

        url = reverse(
            "sentry-api-0-project-release-files",
            kwargs={
                "organization_slug": project.organization.slug,
                "project_slug": project.slug,
                "version": release.version,
            },
        )

        self.login_as(user=self.user)

        response = self.client.post(
            url,
            {
                "name": "http://example.com/application.js",
                "header": "X-SourceMap: http://example.com",
                "file": SimpleUploadedFile(
                    "application.js", b"function() { }", content_type="application/javascript"
                ),
            },
            format="multipart",
        )

        assert release.count_artifacts() == 1

        assert response.status_code == 201, response.content

        releasefile = ReleaseFile.objects.get(release_id=release.id)
        assert releasefile.name == "http://example.com/application.js"
        assert releasefile.ident == ReleaseFile.get_ident("http://example.com/application.js")
        assert releasefile.file.headers == {
            "Content-Type": "application/javascript",
            "X-SourceMap": "http://example.com",
        }

    def test_no_file(self):
        project = self.create_project(name="foo")

        release = Release.objects.create(organization_id=project.organization_id, version="1")
        release.add_project(project)

        url = reverse(
            "sentry-api-0-project-release-files",
            kwargs={
                "organization_slug": project.organization.slug,
                "project_slug": project.slug,
                "version": release.version,
            },
        )

        self.login_as(user=self.user)

        response = self.client.post(
            url, {"header": "X-SourceMap: http://example.com"}, format="multipart"
        )

        assert response.status_code == 400, response.content

    def test_missing_name(self):
        project = self.create_project(name="foo")

        release = Release.objects.create(organization_id=project.organization_id, version="1")
        release.add_project(project)

        url = reverse(
            "sentry-api-0-project-release-files",
            kwargs={
                "organization_slug": project.organization.slug,
                "project_slug": project.slug,
                "version": release.version,
            },
        )

        self.login_as(user=self.user)

        response = self.client.post(
            url,
            {
                "header": "X-SourceMap: http://example.com",
                # We can't use SimpleUploadedFile here, because it validates file names
                # and doesn't allow for empty strings.
                "file": ContentFile(
                    content=b"function() { }",
                    name="",
                ),
            },
            format="multipart",
        )

        assert response.status_code == 400, response.content

    def test_invalid_name(self):
        project = self.create_project(name="foo")

        release = Release.objects.create(organization_id=project.organization_id, version="1")
        release.add_project(project)

        url = reverse(
            "sentry-api-0-project-release-files",
            kwargs={
                "organization_slug": project.organization.slug,
                "project_slug": project.slug,
                "version": release.version,
            },
        )

        self.login_as(user=self.user)

        response = self.client.post(
            url,
            {
                "name": "http://exa\tmple.com/applic\nati\ron.js\n",
                "header": "X-SourceMap: http://example.com/test.map.js",
                "file": SimpleUploadedFile(
                    "application.js", b"function() { }", content_type="application/javascript"
                ),
            },
            format="multipart",
        )

        assert response.status_code == 400, response.content

    def test_bad_headers(self):
        project = self.create_project(name="foo")

        release = Release.objects.create(organization_id=project.organization_id, version="1")
        release.add_project(project)

        url = reverse(
            "sentry-api-0-project-release-files",
            kwargs={
                "organization_slug": project.organization.slug,
                "project_slug": project.slug,
                "version": release.version,
            },
        )

        self.login_as(user=self.user)

        response = self.client.post(
            url,
            {
                "name": "http://example.com/application.js",
                "header": "lol",
                "file": SimpleUploadedFile(
                    "application.js", b"function() { }", content_type="application/javascript"
                ),
            },
            format="multipart",
        )

        assert response.status_code == 400, response.content

        response = self.client.post(
            url,
            {
                "name": "http://example.com/application.js",
                "header": "X-SourceMap: http://example.com/\r\n\ntest.map.js\n",
                "file": SimpleUploadedFile(
                    "application.js", b"function() { }", content_type="application/javascript"
                ),
            },
            format="multipart",
        )

        assert response.status_code == 400, response.content

    def test_duplicate_file(self):
        project = self.create_project(name="foo")

        release = Release.objects.create(
            project_id=project.id, organization_id=project.organization_id, version="1"
        )
        release.add_project(project)

        url = reverse(
            "sentry-api-0-project-release-files",
            kwargs={
                "organization_slug": project.organization.slug,
                "project_slug": project.slug,
                "version": release.version,
            },
        )

        self.login_as(user=self.user)

        data = {
            "name": "http://example.com/application.js",
            "header": "X-SourceMap: http://example.com",
            "file": SimpleUploadedFile(
                "application.js", b"function() { }", content_type="application/javascript"
            ),
        }

        response = self.client.post(url, data, format="multipart")

        assert response.status_code == 201, response.content

        releasefile = ReleaseFile.objects.get(release_id=release.id)
        assert releasefile.name == "http://example.com/application.js"
        assert releasefile.file.headers == {
            "Content-Type": "application/javascript",
            "X-SourceMap": "http://example.com",
        }

        # Now upload it again!
        response = self.client.post(url, data, format="multipart")

        assert response.status_code == 409, response.content
