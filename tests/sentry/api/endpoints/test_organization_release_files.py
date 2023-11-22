from django.core.files.base import ContentFile
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse

from sentry.models.files.file import File
from sentry.models.release import Release
from sentry.models.releasefile import ReleaseFile
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
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
            "sentry-api-0-organization-release-files",
            kwargs={"organization_slug": project.organization.slug, "version": release.version},
        )

        self.login_as(user=self.user)

        response = self.client.get(url)

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(releasefile.id)

    def test_name_search(self):
        project = self.create_project(name="foo")

        release = Release.objects.create(organization_id=project.organization_id, version="1")
        release.add_project(project)

        releasefile_foo = ReleaseFile.objects.create(
            organization_id=project.organization_id,
            release_id=release.id,
            file=File.objects.create(name="foo.js", type="release.file"),
            name="~/foo.js",
        )
        releasefile_bar = ReleaseFile.objects.create(
            organization_id=project.organization_id,
            release_id=release.id,
            file=File.objects.create(name="bar.js", type="release.file"),
            name="~/bar.js",
        )

        url = reverse(
            "sentry-api-0-organization-release-files",
            kwargs={"organization_slug": project.organization.slug, "version": release.version},
        )

        self.login_as(user=self.user)

        response = self.client.get(url + "?query=foo")

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(releasefile_foo.id)

        response = self.client.get(url + "?query=bar")

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(releasefile_bar.id)

        response = self.client.get(url + "?query=foo&query=bar")

        assert response.status_code == 200, response.content
        assert len(response.data) == 2
        # Should be sorted by name
        assert response.data[0]["id"] == str(releasefile_bar.id)
        assert response.data[1]["id"] == str(releasefile_foo.id)

        response = self.client.get(url + "?query=missing")

        assert response.status_code == 200, response.content
        assert len(response.data) == 0

    def test_checksum_search(self):
        project = self.create_project(name="foo")

        release = Release.objects.create(organization_id=project.organization_id, version="1")
        release.add_project(project)

        releasefile_foo = ReleaseFile.objects.create(
            organization_id=project.organization_id,
            release_id=release.id,
            file=File.objects.create(
                name="foo.js",
                type="release.file",
                checksum="3004341003e829253133f75eac9367167ef8d5ea",
            ),
            name="~/foo.js",
        )
        releasefile_bar = ReleaseFile.objects.create(
            organization_id=project.organization_id,
            release_id=release.id,
            file=File.objects.create(
                name="bar.js",
                type="release.file",
                checksum="3003341003e829253143f75eac9367167ef8d5ea",
            ),
            name="~/bar.js",
        )

        url = reverse(
            "sentry-api-0-organization-release-files",
            kwargs={"organization_slug": project.organization.slug, "version": release.version},
        )

        self.login_as(user=self.user)

        response = self.client.get(url + "?checksum=3004341003e829253133f75eac9367167ef8d5ea")
        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(releasefile_foo.id)

        response = self.client.get(url + "?checksum=3003341003e829253143f75eac9367167ef8d5ea")
        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(releasefile_bar.id)

        response = self.client.get(
            url
            + "?checksum=3004341003e829253133f75eac9367167ef8d5ea&checksum=3003341003e829253143f75eac9367167ef8d5ea"
        )
        assert response.status_code == 200, response.content
        assert len(response.data) == 2
        assert response.data[0]["id"] == str(releasefile_bar.id)
        assert response.data[1]["id"] == str(releasefile_foo.id)

        response = self.client.get(url + "?checksum=0000111122223333444455556666777788889999")
        assert response.status_code == 200, response.content
        assert len(response.data) == 0

    def test_queries_should_be_narrowing_search(self):
        project = self.create_project(name="foo")

        release = Release.objects.create(organization_id=project.organization_id, version="1")
        release.add_project(project)

        ReleaseFile.objects.create(
            organization_id=project.organization_id,
            release_id=release.id,
            file=File.objects.create(
                name="foo.js",
                type="release.file",
                checksum="3004341003e829253133f75eac9367167ef8d5ea",
            ),
            name="~/foo.js",
        )
        releasefile_bar = ReleaseFile.objects.create(
            organization_id=project.organization_id,
            release_id=release.id,
            file=File.objects.create(
                name="bar.js",
                type="release.file",
                checksum="3003341003e829253143f75eac9367167ef8d5ea",
            ),
            name="~/bar.js",
        )

        url = reverse(
            "sentry-api-0-organization-release-files",
            kwargs={"organization_slug": project.organization.slug, "version": release.version},
        )

        self.login_as(user=self.user)

        # Found `foo` and `bar` by name, but only `bar` by checksum.
        response = self.client.get(
            url + "?query=foo&query=bar&checksum=3003341003e829253143f75eac9367167ef8d5ea"
        )
        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(releasefile_bar.id)

        # Found `foo` and `bar` by name, but nothing by checksum.
        response = self.client.get(
            url + "?query=foo&query=bar&checksum=0000111122223333444455556666777788889999"
        )
        assert response.status_code == 200, response.content
        assert len(response.data) == 0


@region_silo_test
class ReleaseFileCreateTest(APITestCase):
    def test_simple(self):
        project = self.create_project(name="foo")

        release = Release.objects.create(organization_id=project.organization_id, version="1")
        release.add_project(project)

        assert release.count_artifacts() == 0

        url = reverse(
            "sentry-api-0-organization-release-files",
            kwargs={"organization_slug": project.organization.slug, "version": release.version},
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
            "sentry-api-0-organization-release-files",
            kwargs={"organization_slug": project.organization.slug, "version": release.version},
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
            "sentry-api-0-organization-release-files",
            kwargs={"organization_slug": project.organization.slug, "version": release.version},
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
            "sentry-api-0-organization-release-files",
            kwargs={"organization_slug": project.organization.slug, "version": release.version},
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
            "sentry-api-0-organization-release-files",
            kwargs={"organization_slug": project.organization.slug, "version": release.version},
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
            "sentry-api-0-organization-release-files",
            kwargs={"organization_slug": project.organization.slug, "version": release.version},
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
