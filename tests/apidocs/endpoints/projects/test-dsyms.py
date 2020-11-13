# -*- coding: utf-8 -*-

from __future__ import absolute_import

import zipfile
from six import BytesIO

from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.urlresolvers import reverse
from django.test.client import RequestFactory

from tests.apidocs.util import APIDocsTestCase


class ProjectDsymsDocs(APIDocsTestCase):
    def setUp(self):
        self.url = reverse(
            "sentry-api-0-dsym-files",
            kwargs={"organization_slug": self.organization.slug, "project_slug": self.project.slug},
        )
        self.create_dif_file(project=self.project)

        self.login_as(user=self.user)

    def test_get(self):
        response = self.client.get(self.url)
        request = RequestFactory().get(self.url)

        self.validate_schema(request, response)

    def test_post(self):
        PROGUARD_UUID = "6dc7fdb0-d2fb-4c8e-9d6b-bb1aa98929b1"
        PROGUARD_SOURCE = b"""\
        org.slf4j.helpers.Util$ClassContextSecurityManager -> org.a.b.g$a:
        65:65:void <init>() -> <init>
        67:67:java.lang.Class[] getClassContext() -> getClassContext
        65:65:void <init>(org.slf4j.helpers.Util$1) -> <init>
        """
        out = BytesIO()
        f = zipfile.ZipFile(out, "w")
        f.writestr("proguard/%s.txt" % PROGUARD_UUID, PROGUARD_SOURCE)
        f.close()
        data = {
            "file": SimpleUploadedFile(
                "symbols.zip", out.getvalue(), content_type="application/zip"
            ),
        }

        response = self.client.post(self.url, data, format="multipart",)
        request = RequestFactory().post(self.url, data)

        self.validate_schema(request, response)
