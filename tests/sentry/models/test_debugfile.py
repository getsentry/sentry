from __future__ import absolute_import

import os
import time
import zipfile
from six import BytesIO, text_type

from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.urlresolvers import reverse

from symbolic import SYMCACHE_LATEST_VERSION

from sentry.testutils import APITestCase, TestCase
from sentry.models import File, ProjectDebugFile, ProjectSymCacheFile

# This is obviously a freely generated UUID and not the checksum UUID.
# This is permissible if users want to send different UUIDs
PROGUARD_UUID = text_type('6dc7fdb0-d2fb-4c8e-9d6b-bb1aa98929b1')
PROGUARD_SOURCE = b'''\
org.slf4j.helpers.Util$ClassContextSecurityManager -> org.a.b.g$a:
65:65:void <init>() -> <init>
67:67:java.lang.Class[] getClassContext() -> getClassContext
65:65:void <init>(org.slf4j.helpers.Util$1) -> <init>
'''


class DebugFileTest(TestCase):
    def test_delete_dif(self):
        dif_file = self.create_file(
            name='baz.dSYM',
            size=42,
            headers={'Content-Type': 'application/x-mach-binary'},
            checksum='dc1e3f3e411979d336c3057cce64294f3420f93a',
        )

        dif = self.create_dif_file(
            debug_id='dfb8e43a-f242-3d73-a453-aeb6a777ef75-feedface',
            object_name='baz.dSYM',
            cpu_name='x86_64',
            file=dif_file,
            data={'features': ['debug']},
        )

        cache_file = self.create_file(
            name='baz.symc',
            size=42,
            headers={'Content-Type': 'application/x-sentry-symcache'},
            checksum='dc1e3f3e411979d336c3057cce64294f3420f93a',
        )

        symcache = ProjectSymCacheFile.objects.create(
            project=self.project,
            cache_file=cache_file,
            dsym_file=dif,
            checksum='dc1e3f3e411979d336c3057cce64294f3420f93a',
            version=SYMCACHE_LATEST_VERSION,
        )

        dif.delete()

        assert not ProjectDebugFile.objects.filter(id=dif.id).exists()
        assert not File.objects.filter(id=dif_file.id).exists()
        assert not ProjectSymCacheFile.objects.filter(id=symcache.id).exists()
        assert not File.objects.filter(id=cache_file.id).exists()


class DebugFilesClearTest(APITestCase):
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
        assert response.data[0]['uuid'] == PROGUARD_UUID
        assert response.data[0]['objectName'] == 'proguard-mapping'
        assert response.data[0]['cpuName'] == 'any'
        assert response.data[0]['symbolType'] == 'proguard'

        difs = ProjectDebugFile.difcache.fetch_difs(
            project=project,
            debug_ids=[PROGUARD_UUID],
            features=['mapping'])
        assert len(difs) == 1
        assert os.path.isfile(difs[PROGUARD_UUID])

        # if we clear now, nothing happens
        ProjectDebugFile.difcache.clear_old_entries()
        assert os.path.isfile(difs[PROGUARD_UUID])

        # Put the time into the future
        real_time = time.time
        time.time = lambda: real_time() + 60 * 60 * 48
        try:
            ProjectDebugFile.difcache.clear_old_entries()
        finally:
            time.time = real_time

        # But it's gone now
        assert not os.path.isfile(difs[PROGUARD_UUID])


class SymCacheTest(TestCase):
    def test_create_symcache(self):
        file = File.objects.create(
            name='crash.dSYM',
            type='default',
            headers={'Content-Type': 'application/x-mach-binary'},
        )

        path = os.path.join(os.path.dirname(__file__), 'fixtures', 'crash.dsym')
        with open(path) as f:
            file.putfile(f)

        debug_id = '67e9247c-814e-392b-a027-dbde6748fcbf'
        ProjectDebugFile.objects.create(
            file=file,
            object_name='crash.dSYM',
            cpu_name='x86',
            project=self.project,
            debug_id=debug_id,
        )

        symcaches = ProjectDebugFile.difcache.get_symcaches(self.project, [debug_id])
        symcache = symcaches['67e9247c-814e-392b-a027-dbde6748fcbf']

        assert symcache.id == debug_id
        assert symcache.is_latest_file_format

    def test_update_symcache(self):
        file = File.objects.create(
            name='crash.dSYM',
            type='default',
            headers={'Content-Type': 'application/x-mach-binary'},
        )

        path = os.path.join(os.path.dirname(__file__), 'fixtures', 'crash.dsym')
        with open(path) as f:
            file.putfile(f)

        debug_id = '67e9247c-814e-392b-a027-dbde6748fcbf'
        debug_file = ProjectDebugFile.objects.create(
            file=file,
            object_name='crash.dSYM',
            cpu_name='x86',
            project=self.project,
            debug_id=debug_id,
        )

        file = File.objects.create(
            name='v1.symc',
            type='project.symcache',
        )

        path = os.path.join(os.path.dirname(__file__), 'fixtures', 'v1.symc')
        with open(path) as f:
            file.putfile(f)

        # Create an outdated SymCache to replace
        ProjectSymCacheFile.objects.create(
            project=debug_file.project,
            cache_file=file,
            dsym_file=debug_file,
            checksum=debug_file.file.checksum,
            version=1,
        )

        symcaches = ProjectDebugFile.difcache.get_symcaches(self.project, [debug_id])
        symcache = symcaches['67e9247c-814e-392b-a027-dbde6748fcbf']

        assert symcache.id == debug_id
        assert symcache.is_latest_file_format

    def test_delete_symcache(self):
        dif_file = self.create_file(
            name='baz.dSYM',
            size=42,
            headers={'Content-Type': 'application/x-mach-binary'},
            checksum='dc1e3f3e411979d336c3057cce64294f3420f93a',
        )

        dif = self.create_dif_file(
            debug_id='dfb8e43a-f242-3d73-a453-aeb6a777ef75-feedface',
            object_name='baz.dSYM',
            cpu_name='x86_64',
            file=dif_file,
            data={'features': ['debug']},
        )

        cache_file = self.create_file(
            name='baz.symc',
            size=42,
            headers={'Content-Type': 'application/x-sentry-symcache'},
            checksum='dc1e3f3e411979d336c3057cce64294f3420f93a',
        )

        symcache = ProjectSymCacheFile.objects.create(
            project=self.project,
            cache_file=cache_file,
            dsym_file=dif,
            checksum='dc1e3f3e411979d336c3057cce64294f3420f93a',
            version=SYMCACHE_LATEST_VERSION,
        )

        symcache.delete()

        assert not File.objects.filter(id=cache_file.id).exists()
        assert not ProjectSymCacheFile.objects.filter(id=symcache.id).exists()
