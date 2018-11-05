from __future__ import absolute_import

import os
import time
import zipfile
from six import BytesIO, text_type

from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.urlresolvers import reverse

from symbolic import SYMCACHE_LATEST_VERSION

from sentry.testutils import APITestCase, TestCase
from sentry.models import debugfile, File, ProjectDebugFile, ProjectSymCacheFile, \
    ProjectCfiCacheFile

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
        dif = self.create_dif_file(
            debug_id='dfb8e43a-f242-3d73-a453-aeb6a777ef75-feedface',
            features=['debug', 'unwind'],
        )

        symcache_file = self.create_file(
            name='baz.symcache',
            size=42,
            headers={'Content-Type': 'application/x-sentry-symcache'},
            checksum='dc1e3f3e411979d336c3057cce64294f3420f93a',
        )

        symcache = ProjectSymCacheFile.objects.create(
            project=self.project,
            cache_file=symcache_file,
            debug_file=dif,
            checksum='dc1e3f3e411979d336c3057cce64294f3420f93a',
            version=SYMCACHE_LATEST_VERSION,
        )

        cficache_file = self.create_file(
            name='baz.cficache',
            size=42,
            headers={'Content-Type': 'application/x-sentry-cficache'},
            checksum='dc1e3f3e411979d336c3057cce64294f3420f93a',
        )

        cficache = ProjectCfiCacheFile.objects.create(
            project=self.project,
            cache_file=cficache_file,
            debug_file=dif,
            checksum='dc1e3f3e411979d336c3057cce64294f3420f93a',
            version=SYMCACHE_LATEST_VERSION,
        )

        dif_id = dif.id
        dif.delete()

        assert not ProjectDebugFile.objects.filter(id=dif_id).exists()
        assert not File.objects.filter(id=dif.file.id).exists()
        assert not ProjectSymCacheFile.objects.filter(id=symcache.id).exists()
        assert not File.objects.filter(id=symcache_file.id).exists()
        assert not ProjectCfiCacheFile.objects.filter(id=cficache.id).exists()
        assert not File.objects.filter(id=cficache_file.id).exists()

    def test_find_dif_by_debug_id(self):
        debug_id1 = 'dfb8e43a-f242-3d73-a453-aeb6a777ef75'
        debug_id2 = '19bd7a09-3e31-4911-a5cd-8e829b845407'
        debug_id3 = '7d402821-fae6-4ebc-bbb2-152f8e3b3352'

        self.create_dif_file(debug_id=debug_id1)
        dif1 = self.create_dif_file(debug_id=debug_id1)
        dif2 = self.create_dif_file(debug_id=debug_id2)

        difs = ProjectDebugFile.objects.find_by_debug_ids(
            project=self.project,
            debug_ids=[debug_id1, debug_id2, debug_id3],
        )

        assert difs[debug_id1].id == dif1.id
        assert difs[debug_id2].id == dif2.id
        assert debug_id3 not in difs

    def test_find_dif_by_feature(self):
        debug_id1 = 'dfb8e43a-f242-3d73-a453-aeb6a777ef75'
        debug_id2 = '19bd7a09-3e31-4911-a5cd-8e829b845407'
        debug_id3 = '7d402821-fae6-4ebc-bbb2-152f8e3b3352'

        self.create_dif_file(debug_id=debug_id1, features=['debug'])
        dif1 = self.create_dif_file(debug_id=debug_id1, features=['debug'])
        self.create_dif_file(debug_id=debug_id1, features=['unwind'])
        dif2 = self.create_dif_file(debug_id=debug_id2)

        difs = ProjectDebugFile.objects.find_by_debug_ids(
            project=self.project,
            debug_ids=[debug_id1, debug_id2, debug_id3],
            features=['debug'],
        )

        assert difs[debug_id1].id == dif1.id
        assert difs[debug_id2].id == dif2.id
        assert debug_id3 not in difs

    def test_find_dif_by_features(self):
        debug_id1 = 'dfb8e43a-f242-3d73-a453-aeb6a777ef75'
        debug_id2 = '19bd7a09-3e31-4911-a5cd-8e829b845407'
        debug_id3 = '7d402821-fae6-4ebc-bbb2-152f8e3b3352'

        dif1 = self.create_dif_file(debug_id=debug_id1, features=['debug', 'unwind'])
        self.create_dif_file(debug_id=debug_id1, features=['debug'])
        self.create_dif_file(debug_id=debug_id1, features=['unwind'])
        dif2 = self.create_dif_file(debug_id=debug_id2)

        difs = ProjectDebugFile.objects.find_by_debug_ids(
            project=self.project,
            debug_ids=[debug_id1, debug_id2, debug_id3],
            features=['debug', 'unwind'],
        )

        assert difs[debug_id1].id == dif1.id
        assert difs[debug_id2].id == dif2.id
        assert debug_id3 not in difs

    def test_find_legacy_dif_by_features(self):
        debug_id1 = 'dfb8e43a-f242-3d73-a453-aeb6a777ef75'
        self.create_dif_file(debug_id=debug_id1)
        dif1 = self.create_dif_file(debug_id=debug_id1)

        # XXX: If no file has features, in a group, the newest one is chosen,
        # regardless of the required feature set.
        difs = ProjectDebugFile.objects.find_by_debug_ids(
            project=self.project, debug_ids=[debug_id1], features=['debug'])
        assert difs[debug_id1].id == dif1.id

    def test_find_dif_miss_by_features(self):
        debug_id = 'dfb8e43a-f242-3d73-a453-aeb6a777ef75'
        self.create_dif_file(debug_id=debug_id, features=[])

        difs = ProjectDebugFile.objects.find_by_debug_ids(
            project=self.project, debug_ids=[debug_id], features=['debug'])
        assert debug_id not in difs


class CreateDebugFileTest(APITestCase):
    @property
    def file_path(self):
        return os.path.join(os.path.dirname(__file__), 'fixtures', 'crash.dsym')

    def create_dif(self, **kwargs):
        args = {
            'project': self.project,
            'dif_type': 'macho',
            'cpu_name': 'x86_64',
            'debug_id': '67e9247c-814e-392b-a027-dbde6748fcbf',
            'data': {'features': ['debug']},
            'basename': 'crash.dsym',
        }

        args.update(kwargs)
        return debugfile.create_dif_from_id(**args)

    def test_create_dif_from_file(self):
        file = self.create_file(name='crash.dsym',
                                checksum='dc1e3f3e411979d336c3057cce64294f3420f93a')
        dif, created = self.create_dif(file=file)

        assert created
        assert dif is not None
        assert dif.file.type == 'project.dif'
        assert 'Content-Type' in dif.file.headers
        assert ProjectDebugFile.objects.filter(id=dif.id).exists()

    def test_create_dif_from_fileobj(self):
        with open(self.file_path) as f:
            dif, created = self.create_dif(fileobj=f)

        assert created
        assert dif is not None
        assert dif.file.type == 'project.dif'
        assert 'Content-Type' in dif.file.headers
        assert ProjectDebugFile.objects.filter(id=dif.id).exists()

    def test_keep_disjoint_difs(self):
        file = self.create_file(name='crash.dsym',
                                checksum='dc1e3f3e411979d336c3057cce64294f3420f93a')
        dif1, created1 = self.create_dif(file=file, data={'features': ['unwind']})

        file = self.create_file(name='crash.dsym',
                                checksum='2b92c5472f4442a27da02509951ea2e0f529511c')
        dif2, created2 = self.create_dif(file=file, data={'features': ['debug']})

        assert created1 and created2
        assert ProjectDebugFile.objects.filter(id=dif1.id).exists()
        assert ProjectDebugFile.objects.filter(id=dif2.id).exists()

    def test_keep_overlapping_difs(self):
        file = self.create_file(name='crash.dsym',
                                checksum='dc1e3f3e411979d336c3057cce64294f3420f93a')
        dif1, created1 = self.create_dif(file=file, data={'features': ['symtab', 'unwind']})

        file = self.create_file(name='crash.dsym',
                                checksum='2b92c5472f4442a27da02509951ea2e0f529511c')
        dif2, created2 = self.create_dif(file=file, data={'features': ['symtab', 'debug']})

        assert created1 and created2
        assert ProjectDebugFile.objects.filter(id=dif1.id).exists()
        assert ProjectDebugFile.objects.filter(id=dif2.id).exists()

    def test_keep_latest_dif(self):
        file = self.create_file(name='crash.dsym',
                                checksum='dc1e3f3e411979d336c3057cce64294f3420f93a')
        dif1, created1 = self.create_dif(file=file, data={'features': ['debug', 'unwind']})

        file = self.create_file(name='crash.dsym',
                                checksum='2b92c5472f4442a27da02509951ea2e0f529511c')
        dif2, created2 = self.create_dif(file=file, data={'features': ['debug']})

        file = self.create_file(name='crash.dsym',
                                checksum='3c60980275c4adc81a657f6aae00e11ed528b538')
        dif3, created3 = self.create_dif(file=file, data={'features': []})

        # XXX: dif2 and dif3 would actually be redundant, but since they are more
        # recent than dif1 we keep both of them. This assumes that newer uploads
        # might contain more specific debug information and should therefore
        # receive precedence over older ones.
        assert created1 and created2 and created3
        assert ProjectDebugFile.objects.filter(id=dif1.id).exists()
        assert ProjectDebugFile.objects.filter(id=dif2.id).exists()
        assert ProjectDebugFile.objects.filter(id=dif3.id).exists()

    def test_skip_redundant_dif(self):
        with open(self.file_path) as f:
            dif1, created1 = self.create_dif(fileobj=f)

        with open(self.file_path) as f:
            dif2, created2 = self.create_dif(fileobj=f)

        assert created1
        assert not created2
        assert dif1 == dif2

    def test_remove_redundant_dif(self):
        file = self.create_file(name='crash.dsym',
                                checksum='dc1e3f3e411979d336c3057cce64294f3420f93a')
        dif1, created1 = self.create_dif(file=file, data={'features': ['debug']})

        file = self.create_file(name='crash.dsym',
                                checksum='2b92c5472f4442a27da02509951ea2e0f529511c')
        dif2, created2 = self.create_dif(file=file, data={'features': ['debug']})

        assert created1 and created2
        assert not ProjectDebugFile.objects.filter(id=dif1.id).exists()
        assert ProjectDebugFile.objects.filter(id=dif2.id).exists()


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
    def test_get_symcache(self):
        debug_id = '67e9247c-814e-392b-a027-dbde6748fcbf'
        dif = self.create_dif_from_path(
            path=os.path.join(os.path.dirname(__file__), 'fixtures', 'crash.dsym'),
            debug_id=debug_id,
            features=['debug'],
        )

        file = self.create_file_from_path(
            path=os.path.join(os.path.dirname(__file__), 'fixtures', 'v1.symcache'),
            type='project.symcache'
        )

        ProjectSymCacheFile.objects.create(
            project=self.project,
            cache_file=file,
            debug_file=dif,
            checksum=dif.file.checksum,
            # XXX: This version does not correspond to the actual file version,
            # but is sufficient to avoid update behavior
            version=SYMCACHE_LATEST_VERSION,
        )

        symcaches = ProjectDebugFile.difcache.get_symcaches(self.project, [debug_id])
        assert debug_id in symcaches
        assert symcaches[debug_id].id == debug_id

    def test_miss_symcache_without_feature(self):
        debug_id = '67e9247c-814e-392b-a027-dbde6748fcbf'
        self.create_dif_from_path(
            path=os.path.join(os.path.dirname(__file__), 'fixtures', 'crash.dsym'),
            debug_id=debug_id,
        )
        self.create_dif_from_path(
            path=os.path.join(os.path.dirname(__file__), 'fixtures', 'crash.dsym'),
            debug_id=debug_id,
            features=[],
        )

        # XXX: Explicit empty set denotes DIF without features. Since at least
        # one file has declared features, get_symcaches will rather not use the
        # other untagged file.
        symcaches = ProjectDebugFile.difcache.get_symcaches(self.project, [debug_id])
        assert debug_id not in symcaches

    def test_create_symcache_without_feature(self):
        debug_id = '67e9247c-814e-392b-a027-dbde6748fcbf'
        self.create_dif_from_path(
            path=os.path.join(os.path.dirname(__file__), 'fixtures', 'crash.dsym'),
            debug_id=debug_id,
            dif_type='macho',  # XXX: Needed for legacy compatibility check
        )

        symcaches = ProjectDebugFile.difcache.get_symcaches(self.project, [debug_id])
        assert debug_id in symcaches
        assert symcaches[debug_id].id == debug_id

    def test_create_symcache_with_feature(self):
        debug_id = '67e9247c-814e-392b-a027-dbde6748fcbf'
        self.create_dif_from_path(
            path=os.path.join(os.path.dirname(__file__), 'fixtures', 'crash.dsym'),
            debug_id=debug_id,
            features=['debug'],
        )

        symcaches = ProjectDebugFile.difcache.get_symcaches(self.project, [debug_id])
        assert debug_id in symcaches
        assert symcaches[debug_id].id == debug_id

    def test_skip_symcache_without_feature(self):
        debug_id = '1ddb3423-950a-3646-b17b-d4360e6acfc9'
        self.create_dif_from_path(
            path=os.path.join(os.path.dirname(__file__), 'fixtures', 'crash'),
            debug_id=debug_id,
            dif_type='macho',
        )

        symcaches = ProjectDebugFile.difcache.get_symcaches(self.project, [debug_id])
        assert not symcaches

    def test_update_symcache(self):
        debug_id = '67e9247c-814e-392b-a027-dbde6748fcbf'
        dif = self.create_dif_from_path(
            path=os.path.join(os.path.dirname(__file__), 'fixtures', 'crash.dsym'),
            debug_id=debug_id,
        )

        file = self.create_file_from_path(
            path=os.path.join(os.path.dirname(__file__), 'fixtures', 'v1.symcache'),
            headers={'Content-Type': 'application/x-sentry-symcache'},
            type='project.symcache'
        )

        # Create an outdated SymCache to replace
        old_cache = ProjectSymCacheFile.objects.create(
            project=self.project,
            cache_file=file,
            debug_file=dif,
            checksum=dif.file.checksum,
            version=1,
        )

        symcaches = ProjectDebugFile.difcache.get_symcaches(self.project, [debug_id])
        assert debug_id in symcaches
        assert symcaches[debug_id].id == debug_id
        assert symcaches[debug_id].is_latest_file_format
        assert not ProjectSymCacheFile.objects.filter(id=old_cache.id, version=1).exists()

    def test_get_symcache_on_referenced(self):
        debug_id = '67e9247c-814e-392b-a027-dbde6748fcbf'
        dif = self.create_dif_from_path(
            path=os.path.join(os.path.dirname(__file__), 'fixtures', 'crash.dsym'),
            debug_id=debug_id,
            features=['debug']
        )

        referenced_ids = []

        def dif_referenced(dif):
            referenced_ids.append(dif.id)

        ProjectDebugFile.difcache.get_symcaches(
            self.project,
            [debug_id],
            on_dif_referenced=dif_referenced
        )
        assert referenced_ids == [dif.id]

    def test_symcache_conversion_error(self):
        debug_id = '67e9247c-814e-392b-a027-dbde6748fcbf'
        self.create_dif_file(
            debug_id=debug_id,
            features=['debug']
        )

        symcaches, errors = ProjectDebugFile.difcache.get_symcaches(
            self.project,
            [debug_id],
            with_conversion_errors=True
        )
        assert debug_id not in symcaches
        assert debug_id in errors

    def test_delete_symcache(self):
        dif = self.create_dif_file(
            debug_id='dfb8e43a-f242-3d73-a453-aeb6a777ef75-feedface',
            features=['debug']
        )

        cache_file = self.create_file(
            name='baz.symc',
            size=42,
            headers={'Content-Type': 'application/x-sentry-symcache'},
            checksum='dc1e3f3e411979d336c3057cce64294f3420f93a',
            type='project.symcache'
        )

        symcache = ProjectSymCacheFile.objects.create(
            project=self.project,
            cache_file=cache_file,
            debug_file=dif,
            checksum=dif.file.checksum,
            version=SYMCACHE_LATEST_VERSION,
        )

        symcache.delete()
        assert not File.objects.filter(id=cache_file.id).exists()
        assert not ProjectSymCacheFile.objects.filter(id=symcache.id).exists()


class CfiCacheTest(TestCase):
    def test_get_cficache(self):
        debug_id = '1ddb3423-950a-3646-b17b-d4360e6acfc9'
        dif = self.create_dif_from_path(
            path=os.path.join(os.path.dirname(__file__), 'fixtures', 'crash'),
            debug_id=debug_id,
            features=['unwind'],
        )

        file = self.create_file_from_path(
            path=os.path.join(os.path.dirname(__file__), 'fixtures', 'v1.cficache'),
            type='project.cficache'
        )

        ProjectCfiCacheFile.objects.create(
            project=self.project,
            cache_file=file,
            debug_file=dif,
            checksum=dif.file.checksum,
            # XXX: This version does not correspond to the actual file version,
            # but is sufficient to avoid update behavior
            version=SYMCACHE_LATEST_VERSION,
        )

        cficaches = ProjectDebugFile.difcache.get_cficaches(self.project, [debug_id])
        assert debug_id in cficaches

    def test_miss_cficache_without_feature(self):
        debug_id = '1ddb3423-950a-3646-b17b-d4360e6acfc9'
        self.create_dif_from_path(
            path=os.path.join(os.path.dirname(__file__), 'fixtures', 'crash'),
            debug_id=debug_id,
            features=[],
        )

        # XXX: Explicit empty set denotes DIF without features. Since at least
        # one file has declared features, get_cficaches will rather not use the
        # other untagged file.
        cficaches = ProjectDebugFile.difcache.get_cficaches(self.project, [debug_id])
        assert debug_id not in cficaches

    def test_create_cficache_with_feature(self):
        debug_id = '1ddb3423-950a-3646-b17b-d4360e6acfc9'
        self.create_dif_from_path(
            path=os.path.join(os.path.dirname(__file__), 'fixtures', 'crash'),
            debug_id=debug_id,
            features=['unwind'],
        )

        cficaches = ProjectDebugFile.difcache.get_cficaches(self.project, [debug_id])
        assert debug_id in cficaches

    def test_skip_cficache_without_feature(self):
        debug_id = '67e9247c-814e-392b-a027-dbde6748fcbf'
        self.create_dif_from_path(
            path=os.path.join(os.path.dirname(__file__), 'fixtures', 'crash.dsym'),
            debug_id=debug_id,
            dif_type='macho',
        )

        symcaches = ProjectDebugFile.difcache.get_cficaches(self.project, [debug_id])
        assert not symcaches

    def test_update_cficache(self):
        debug_id = '1ddb3423-950a-3646-b17b-d4360e6acfc9'
        dif = self.create_dif_from_path(
            path=os.path.join(os.path.dirname(__file__), 'fixtures', 'crash'),
            debug_id=debug_id,
            features=['unwind'],
        )

        file = self.create_file_from_path(
            path=os.path.join(os.path.dirname(__file__), 'fixtures', 'v1.symcache'),
            headers={'Content-Type': 'application/x-sentry-cficache'},
            type='project.cficache'
        )

        # Create an outdated CfiCache to replace
        old_cache = ProjectCfiCacheFile.objects.create(
            project=self.project,
            cache_file=file,
            debug_file=dif,
            checksum=dif.file.checksum,
            version=0,
        )

        cficaches = ProjectDebugFile.difcache.get_cficaches(self.project, [debug_id])
        assert debug_id in cficaches
        assert cficaches[debug_id].is_latest_file_format
        assert not ProjectCfiCacheFile.objects.filter(id=old_cache.id, version=0).exists()

    def test_get_cficache_on_referenced(self):
        debug_id = '1ddb3423-950a-3646-b17b-d4360e6acfc9'
        dif = self.create_dif_from_path(
            path=os.path.join(os.path.dirname(__file__), 'fixtures', 'crash'),
            debug_id=debug_id,
            features=['unwind'],
        )

        referenced_ids = []

        def dif_referenced(dif):
            referenced_ids.append(dif.id)

        ProjectDebugFile.difcache.get_cficaches(
            self.project,
            [debug_id],
            on_dif_referenced=dif_referenced
        )
        assert referenced_ids == [dif.id]

    def test_cficache_conversion_error(self):
        debug_id = '1ddb3423-950a-3646-b17b-d4360e6acfc9'
        self.create_dif_file(
            debug_id=debug_id,
            features=['unwind'],
        )

        cficaches, errors = ProjectDebugFile.difcache.get_cficaches(
            self.project,
            [debug_id],
            with_conversion_errors=True
        )
        assert debug_id not in cficaches
        assert debug_id in errors

    def test_delete_cficache(self):
        dif = self.create_dif_file(
            debug_id='dfb8e43a-f242-3d73-a453-aeb6a777ef75-feedface',
            features=['unwind'],
        )

        cache_file = self.create_file(
            name='baz.symc',
            size=42,
            headers={'Content-Type': 'application/x-sentry-cficache'},
            checksum='dc1e3f3e411979d336c3057cce64294f3420f93a',
            type='project.cficache'
        )

        cficache = ProjectCfiCacheFile.objects.create(
            project=self.project,
            cache_file=cache_file,
            debug_file=dif,
            checksum=dif.file.checksum,
            version=SYMCACHE_LATEST_VERSION,
        )

        cficache.delete()
        assert not File.objects.filter(id=cache_file.id).exists()
        assert not ProjectCfiCacheFile.objects.filter(id=cficache.id).exists()
