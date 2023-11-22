import errno
import os
from datetime import datetime, timezone
from io import BytesIO
from threading import Thread
from time import sleep
from zipfile import ZipFile

import pytest

from sentry import options
from sentry.models.distribution import Distribution
from sentry.models.files.file import File
from sentry.models.releasefile import (
    ARTIFACT_INDEX_FILENAME,
    ReleaseFile,
    _ArtifactIndexGuard,
    delete_from_artifact_index,
    read_artifact_index,
    update_artifact_index,
)
from sentry.testutils.cases import TestCase, TransactionTestCase
from sentry.testutils.silo import region_silo_test
from sentry.utils import json


@region_silo_test
class ReleaseFileTestCase(TestCase):
    def test_normalize(self):
        n = ReleaseFile.normalize

        assert n("http://example.com") == ["http://example.com", "~"]
        assert n("http://example.com/foo.js") == ["http://example.com/foo.js", "~/foo.js"]
        assert n("http://example.com/foo.js?bar") == [
            "http://example.com/foo.js?bar",
            "http://example.com/foo.js",
            "~/foo.js?bar",
            "~/foo.js",
        ]
        assert n("/foo.js") == ["/foo.js", "~/foo.js"]

        assert n("http://example.com/foo.js?bar#baz") == [
            "http://example.com/foo.js?bar",
            "http://example.com/foo.js",
            "~/foo.js?bar",
            "~/foo.js",
        ]

        # This is the current behavior, but seems weird to me.
        # unclear if we actually experience this case in the real
        # world, but worth documenting the behavior
        assert n("foo.js") == ["foo.js", "~foo.js"]

    def test_count_artifacts(self):
        assert self.release.count_artifacts() == 0
        for count in (3, 1, None, 0):
            file = self.create_file(name=f"dummy-{count}.txt")
            ReleaseFile.objects.create(
                file=file,
                name=f"dummy-{count}.txt",
                organization_id=self.organization.id,
                release_id=self.release.id,
                artifact_count=count,
            )

        assert self.release.count_artifacts() == 5


class ReleaseFileCacheTest(TestCase):
    def test_getfile_fs_cache(self):
        file_content = b"this is a test"

        file = self.create_file(name="dummy.txt")
        file.putfile(BytesIO(file_content))
        release_file = self.create_release_file(file=file)

        expected_path = os.path.join(
            options.get("releasefile.cache-path"),
            str(self.organization.id),
            str(file.id),
        )

        # Set the threshold to zero to force caching on the file system
        options.set("releasefile.cache-limit", 0)
        with ReleaseFile.cache.getfile(release_file) as f:
            assert f.read() == file_content
            assert f.name == expected_path

        # Check that the file was cached
        os.stat(expected_path)

    def test_getfile_streaming(self):
        file_content = b"this is a test"

        file = self.create_file(name="dummy.txt")
        file.putfile(BytesIO(file_content))
        release_file = self.create_release_file(file=file)

        expected_path = os.path.join(
            options.get("releasefile.cache-path"),
            str(self.organization.id),
            str(file.id),
        )

        # Set the threshold larger than the file size to force streaming
        options.set("releasefile.cache-limit", 1024)
        with ReleaseFile.cache.getfile(release_file) as f:
            assert f.read() == file_content

        # Check that the file was not cached
        try:
            os.stat(expected_path)
        except OSError as e:
            assert e.errno == errno.ENOENT
        else:
            assert False, "file should not exist"


class ReleaseArchiveTestCase(TestCase):
    def create_archive(self, fields, files, dist=None):
        manifest = dict(
            fields, files={filename: {"url": f"fake://{filename}"} for filename in files}
        )
        buffer = BytesIO()
        with ZipFile(buffer, mode="w") as zf:
            zf.writestr("manifest.json", json.dumps(manifest))
            for filename, content in files.items():
                zf.writestr(filename, content)

        buffer.seek(0)
        file_ = File.objects.create(name=str(hash(tuple(files.items()))))
        file_.putfile(buffer)
        file_.update(timestamp=datetime(2021, 6, 11, 9, 13, 1, 317902, tzinfo=timezone.utc))

        return update_artifact_index(self.release, dist, file_)

    def test_multi_archive(self):
        assert read_artifact_index(self.release, None) is None

        # Delete does nothing
        assert delete_from_artifact_index(self.release, None, "foo") is False

        archive1 = self.create_archive(
            fields={},
            files={
                "foo": "foo",
                "bar": "bar",
                "baz": "bazaa",
            },
        )

        assert read_artifact_index(self.release, None) == {
            "files": {
                "fake://bar": {
                    "archive_ident": archive1.ident,
                    "date_created": "2021-06-11T09:13:01.317902Z",
                    "filename": "bar",
                    "sha1": "62cdb7020ff920e5aa642c3d4066950dd1f01f4d",
                    "size": 3,
                },
                "fake://baz": {
                    "archive_ident": archive1.ident,
                    "date_created": "2021-06-11T09:13:01.317902Z",
                    "filename": "baz",
                    "sha1": "1a74885aa2771a6a0edcc80dbd0cf396dfaf1aab",
                    "size": 5,
                },
                "fake://foo": {
                    "archive_ident": archive1.ident,
                    "date_created": "2021-06-11T09:13:01.317902Z",
                    "filename": "foo",
                    "sha1": "0beec7b5ea3f0fdbc95d0dd47f3c5bc275da8a33",
                    "size": 3,
                },
            },
        }

        # See if creating a second manifest interferes:
        dist = Distribution.objects.create(
            organization_id=self.organization.id, release_id=self.release.id, name="foo"
        )
        self.create_archive(fields={}, files={"xyz": "123"}, dist=dist)

        archive2 = self.create_archive(
            fields={},
            files={
                "foo": "foo",
                "bar": "BAR",
                "zap": "zapz",
            },
        )

        # Two files were overwritten, one was added
        expected = {
            "files": {
                "fake://bar": {
                    "archive_ident": archive2.ident,
                    "date_created": "2021-06-11T09:13:01.317902Z",
                    "filename": "bar",
                    "sha1": "a5d5c1bba91fdb6c669e1ae0413820885bbfc455",
                    "size": 3,
                },
                "fake://baz": {
                    "archive_ident": archive1.ident,
                    "date_created": "2021-06-11T09:13:01.317902Z",
                    "filename": "baz",
                    "sha1": "1a74885aa2771a6a0edcc80dbd0cf396dfaf1aab",
                    "size": 5,
                },
                "fake://foo": {
                    "archive_ident": archive2.ident,
                    "date_created": "2021-06-11T09:13:01.317902Z",
                    "filename": "foo",
                    "sha1": "0beec7b5ea3f0fdbc95d0dd47f3c5bc275da8a33",
                    "size": 3,
                },
                "fake://zap": {
                    "archive_ident": archive2.ident,
                    "date_created": "2021-06-11T09:13:01.317902Z",
                    "filename": "zap",
                    "sha1": "a7a9c12205f9cb1f53f8b6678265c9e8158f2a8f",
                    "size": 4,
                },
            },
        }

        assert read_artifact_index(self.release, None) == expected

        # Deletion works:
        assert delete_from_artifact_index(self.release, None, "fake://foo") is True
        expected["files"].pop("fake://foo")
        assert read_artifact_index(self.release, None) == expected

    def test_same_sha(self):
        """Stand-alone release file has same sha1 as one in manifest"""
        self.create_archive(fields={}, files={"foo": "bar"})
        file_ = File.objects.create()
        file_.putfile(BytesIO(b"bar"))
        self.create_release_file(file=file_)

        index = read_artifact_index(self.release, None)
        assert index is not None
        assert file_.checksum == index["files"]["fake://foo"]["sha1"]


@pytest.mark.skip(reason="Causes 'There is 1 other session using the database.'")
class ArtifactIndexGuardTestCase(TransactionTestCase):
    tick = 0.1  # seconds

    def _create_update_fn(self, initial_delay, locked_delay, files, create):
        def f():
            sleep(initial_delay * self.tick)
            with _ArtifactIndexGuard(self.release, None).writable_data(create=create) as data:
                sleep(locked_delay * self.tick)
                data.update_files(files)

        return f

    def test_locking(self):
        release = self.release
        dist = None

        update1 = self._create_update_fn(0, 2, {"foo": "bar"}, create=True)
        update2 = self._create_update_fn(1, 2, {"123": "xyz"}, create=True)

        threads = [Thread(target=update1), Thread(target=update2)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()

        # Without locking, only key "123" would survive:
        index = read_artifact_index(release, dist)
        assert index is not None
        assert index["files"].keys() == {"foo", "123"}

        # Only one `File` was created:
        assert File.objects.filter(name=ARTIFACT_INDEX_FILENAME).count() == 1

        def delete():
            sleep(2 * self.tick)
            delete_from_artifact_index(release, dist, "foo")

        update3 = self._create_update_fn(1, 2, {"abc": "666"}, create=True)

        threads = [Thread(target=update3), Thread(target=delete)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()

        # Without locking, the delete would be surpassed by the slow update:
        index = read_artifact_index(release, dist)
        assert index is not None
        assert index["files"].keys() == {"123", "abc"}

    def test_lock_existing(self):
        release = self.release
        dist = None

        with _ArtifactIndexGuard(release, dist).writable_data(create=True) as data:
            data.update_files({"0": 0})

        update1 = self._create_update_fn(0, 2, {"foo": "bar"}, create=False)
        update2 = self._create_update_fn(1, 2, {"123": "xyz"}, create=False)

        threads = [Thread(target=update1), Thread(target=update2)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()

        # Without locking, only keys "0", "123" would survive:
        index = read_artifact_index(release, dist)
        assert index is not None
        assert index["files"].keys() == {"0", "foo", "123"}

        def delete():
            sleep(2 * self.tick)
            delete_from_artifact_index(release, dist, "foo")

        update3 = self._create_update_fn(1, 2, {"abc": "666"}, create=False)

        threads = [Thread(target=update3), Thread(target=delete)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()

        # Without locking, the delete would be surpassed by the slow update:
        index = read_artifact_index(release, dist)
        assert index is not None
        assert index["files"].keys() == {"0", "123", "abc"}
