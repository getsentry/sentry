from __future__ import absolute_import

from django.core.urlresolvers import reverse
from django.test.client import RequestFactory

from sentry.models import Release, ReleaseFile
from tests.apidocs.util import APIDocsTestCase


class ReleaseFileDetailsDocsTest(APIDocsTestCase):
    def setUp(self):
        self.login_as(user=self.user)

        project = self.create_project(name="foo")

        release = Release.objects.create(organization_id=project.organization_id, version="1")
        release.add_project(project)

        file1 = self.create_file(
            name="blah.js",
            size=42,
            type="release.file",
            headers={"Content-Type": "application/json"},
            checksum="dc1e3f3e411979d336c3057cce64294f3420f93a",
        )
        releasefile = ReleaseFile.objects.create(
            organization_id=project.organization_id,
            release=release,
            file=file1,
            name="http://example.com/blah.js",
        )
        self.url = reverse(
            "sentry-api-0-organization-release-file-details",
            kwargs={
                "organization_slug": project.organization.slug,
                "version": release.version,
                "file_id": releasefile.id,
            },
        )

    def test_get(self):
        response = self.client.get(self.url)
        request = RequestFactory().get(self.url)

        self.validate_schema(request, response)

    def test_put(self):
        data = {"name": "newfilename.js"}
        response = self.client.put(self.url, data)
        request = RequestFactory().put(self.url, data)

        self.validate_schema(request, response)
