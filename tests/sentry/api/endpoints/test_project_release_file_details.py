from __future__ import absolute_import

import six

from django.core.urlresolvers import reverse

from sentry.models import File, Release, ReleaseFile
from sentry.testutils import APITestCase


class ReleaseFileDetailsTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

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
        assert response.data["id"] == six.text_type(releasefile.id)

    def test_file_download(self):
        self.login_as(user=self.user)

        project = self.create_project(name="foo")

        release = Release.objects.create(organization_id=project.organization_id, version="1")
        release.add_project(project)

        from six import BytesIO

        f = File.objects.create(name="applicatiosn.js", type="release.file")
        f.putfile(BytesIO(b"File contents here"))

        releasefile = ReleaseFile.objects.create(
            organization_id=project.organization_id,
            project_id=project.id,
            release=release,
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

        response = self.client.get(url + "?download=1")
        assert response.status_code == 200, response.content
        assert response.get("Content-Disposition") == 'attachment; filename="appli catios n.js"'
        assert response.get("Content-Length") == six.text_type(f.size)
        assert response.get("Content-Type") == "application/octet-stream"
        assert b"File contents here" == BytesIO(b"".join(response.streaming_content)).getvalue()

        user_no_permission = self.create_user("baz@localhost", username="baz")
        self.login_as(user=user_no_permission)
        response = self.client.get(url + "?download=1")
        assert response.status_code == 403, response.content


class ReleaseFileUpdateTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

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
        assert response.data["id"] == six.text_type(releasefile.id)

        releasefile = ReleaseFile.objects.get(id=releasefile.id)
        assert releasefile.name == "foobar"
        assert releasefile.ident == ReleaseFile.get_ident("foobar")


class ReleaseFileDeleteTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        project = self.create_project(name="foo")

        release = Release.objects.create(
            project_id=project.id, organization_id=project.organization_id, version="1"
        )
        release.add_project(project)

        releasefile = ReleaseFile.objects.create(
            organization_id=project.organization_id,
            release=release,
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

        response = self.client.delete(url)

        assert response.status_code == 204, response.content

        assert not ReleaseFile.objects.filter(id=releasefile.id).exists()
        assert not File.objects.filter(id=releasefile.file.id).exists()
