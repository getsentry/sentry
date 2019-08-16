from __future__ import absolute_import

import six

from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.urlresolvers import reverse

from sentry.models import File, Release, ReleaseFile
from sentry.testutils import APITestCase


class ReleaseFilesListTest(APITestCase):
    def test_simple(self):
        project = self.create_project(name="foo")

        release = Release.objects.create(organization_id=project.organization_id, version="1")
        release.add_project(project)

        releasefile = ReleaseFile.objects.create(
            organization_id=project.organization_id,
            release=release,
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
        assert response.data[0]["id"] == six.text_type(releasefile.id)


class ReleaseFileCreateTest(APITestCase):
    def test_simple(self):
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
                "header": "X-SourceMap: http://example.com",
                "file": SimpleUploadedFile(
                    "application.js", b"function() { }", content_type="application/javascript"
                ),
            },
            format="multipart",
        )

        assert response.status_code == 201, response.content

        releasefile = ReleaseFile.objects.get(release=release)
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
                "file": SimpleUploadedFile(
                    "", b"function() { }", content_type="application/javascript"
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

        releasefile = ReleaseFile.objects.get(release=release)
        assert releasefile.name == "http://example.com/application.js"
        assert releasefile.file.headers == {
            "Content-Type": "application/javascript",
            "X-SourceMap": "http://example.com",
        }

        # Now upload it again!
        response = self.client.post(url, data, format="multipart")

        assert response.status_code == 409, response.content
