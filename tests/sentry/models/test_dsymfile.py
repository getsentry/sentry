from __future__ import absolute_import

import os
import time
import uuid
import zipfile
from six import BytesIO, text_type

from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.urlresolvers import reverse

from sentry.testutils import APITestCase
from sentry.models import ProjectDSymFile

# This is obviously a freely generated UUID and not the checksum UUID.
# This is permissible if users want to send different UUIDs
PROGUARD_UUID = uuid.UUID('6dc7fdb0-d2fb-4c8e-9d6b-bb1aa98929b1')
PROGUARD_SOURCE = b'''\
org.slf4j.helpers.Util$ClassContextSecurityManager -> org.a.b.g$a:
65:65:void <init>() -> <init>
67:67:java.lang.Class[] getClassContext() -> getClassContext
65:65:void <init>(org.slf4j.helpers.Util$1) -> <init>
'''


class DSymFilesClearTest(APITestCase):
    def test_simple_cache_clear(self):
        project = self.create_project(name='foo')

        url = reverse(
            'sentry-api-0-dsym-files',
            kwargs={
                'organization_slug': project.organization.slug,
                'project_slug': project.slug,
            }
        )

        self.login_as(user=self.user)

        out = BytesIO()
        f = zipfile.ZipFile(out, 'w')
        f.writestr('proguard/%s.txt' % PROGUARD_UUID, PROGUARD_SOURCE)
        f.writestr('ignored-file.txt', b'This is just some stuff')
        f.close()

        response = self.client.post(
            url, {
                'file':
                SimpleUploadedFile('symbols.zip', out.getvalue(),
                                   content_type='application/zip'),
            },
            format='multipart'
        )

        assert response.status_code == 201, response.content
        assert len(response.data) == 1
        assert response.data[0]['headers'] == {
            'Content-Type': 'text/x-proguard+plain'}
        assert response.data[0]['sha1'] == 'e6d3c5185dac63eddfdc1a5edfffa32d46103b44'
        assert response.data[0]['uuid'] == text_type(PROGUARD_UUID)
        assert response.data[0]['objectName'] == 'proguard-mapping'
        assert response.data[0]['cpuName'] == 'any'
        assert response.data[0]['symbolType'] == 'proguard'

        dsyms = ProjectDSymFile.dsymcache.fetch_dsyms(
            project=project,
            uuids=[PROGUARD_UUID])
        assert len(dsyms) == 1
        assert os.path.isfile(dsyms[PROGUARD_UUID])

        # if we clear now, nothing happens
        ProjectDSymFile.dsymcache.clear_old_entries()
        assert os.path.isfile(dsyms[PROGUARD_UUID])

        # Put the time into the future
        real_time = time.time
        time.time = lambda: real_time() + 60 * 60 * 48
        try:
            ProjectDSymFile.dsymcache.clear_old_entries()
        finally:
            time.time = real_time

        # But it's gone now
        assert not os.path.isfile(dsyms[PROGUARD_UUID])
