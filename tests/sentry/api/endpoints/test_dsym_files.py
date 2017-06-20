from __future__ import absolute_import

import six
import json
import zipfile
from six import BytesIO

from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.urlresolvers import reverse

from sentry.testutils import APITestCase


# This is obviously a freely generated UUID and not the checksum UUID.
# This is permissible if users want to send different UUIDs
PROGUARD_UUID = '6dc7fdb0-d2fb-4c8e-9d6b-bb1aa98929b1'
PROGUARD_SOURCE = b'''\
org.slf4j.helpers.Util$ClassContextSecurityManager -> org.a.b.g$a:
65:65:void <init>() -> <init>
67:67:java.lang.Class[] getClassContext() -> getClassContext
65:65:void <init>(org.slf4j.helpers.Util$1) -> <init>
'''


class DSymFilesUploadTest(APITestCase):

    def test_simple_proguard_upload(self):
        project = self.create_project(name='foo')

        url = reverse('sentry-api-0-dsym-files', kwargs={
            'organization_slug': project.organization.slug,
            'project_slug': project.slug,
        })

        self.login_as(user=self.user)

        out = BytesIO()
        f = zipfile.ZipFile(out, 'w')
        f.writestr('proguard/%s.txt' % PROGUARD_UUID, PROGUARD_SOURCE)
        f.writestr('ignored-file.txt', b'This is just some stuff')
        f.close()

        response = self.client.post(url, {
            'file': SimpleUploadedFile('symbols.zip', out.getvalue(),
                                       content_type='application/zip'),
        }, format='multipart')

        assert response.status_code == 201, response.content
        assert len(response.data) == 1
        assert response.data[0]['headers'] == {
            'Content-Type': 'text/x-proguard+plain'
        }
        assert response.data[0]['sha1'] == 'e6d3c5185dac63eddfdc1a5edfffa32d46103b44'
        assert response.data[0]['uuid'] == PROGUARD_UUID
        assert response.data[0]['objectName'] == 'proguard-mapping'
        assert response.data[0]['cpuName'] == 'any'
        assert response.data[0]['symbolType'] == 'proguard'
