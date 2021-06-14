import errno
import os
from datetime import datetime, timezone
from io import BytesIO
from zipfile import ZipFile

from sentry import options
from sentry.models import ReleaseArchive, ReleaseFile
from sentry.models.distribution import Distribution
from sentry.models.file import File
from sentry.models.releasefile import ReleaseManifest
from sentry.testutils import TestCase
from sentry.utils import json


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
        file_ = File.objects.create(name="foo")
        file_.putfile(buffer)
        file_.update(timestamp=datetime(2021, 6, 11, 9, 13, 1, 317902, tzinfo=timezone.utc))

        manifest = ReleaseManifest(self.release, dist)

        with ReleaseArchive(file_.getfile()) as archive:
            manifest.update(archive, file_)

        return file_

    def test_multi_archive(self):
        manifest = ReleaseManifest(self.release, None)

        assert manifest.read() is None

        # Delete does nothing
        manifest.delete("foo")

        archive1 = self.create_archive(
            fields={},
            files={
                "foo": "foo",
                "bar": "bar",
                "baz": "bazaa",
            },
        )

        assert manifest.read() == {
            "files": {
                "fake://bar": {
                    "archive_id": archive1.id,
                    "date_created": "2021-06-11T09:13:01.317902Z",
                    "filename": "bar",
                    "sha1": "62cdb7020ff920e5aa642c3d4066950dd1f01f4d",
                    "size": 3,
                },
                "fake://baz": {
                    "archive_id": archive1.id,
                    "date_created": "2021-06-11T09:13:01.317902Z",
                    "filename": "baz",
                    "sha1": "1a74885aa2771a6a0edcc80dbd0cf396dfaf1aab",
                    "size": 5,
                },
                "fake://foo": {
                    "archive_id": archive1.id,
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
                    "archive_id": archive2.id,
                    "date_created": "2021-06-11T09:13:01.317902Z",
                    "filename": "bar",
                    "sha1": "a5d5c1bba91fdb6c669e1ae0413820885bbfc455",
                    "size": 3,
                },
                "fake://baz": {
                    "archive_id": archive1.id,
                    "date_created": "2021-06-11T09:13:01.317902Z",
                    "filename": "baz",
                    "sha1": "1a74885aa2771a6a0edcc80dbd0cf396dfaf1aab",
                    "size": 5,
                },
                "fake://foo": {
                    "archive_id": archive2.id,
                    "date_created": "2021-06-11T09:13:01.317902Z",
                    "filename": "foo",
                    "sha1": "0beec7b5ea3f0fdbc95d0dd47f3c5bc275da8a33",
                    "size": 3,
                },
                "fake://zap": {
                    "archive_id": archive2.id,
                    "date_created": "2021-06-11T09:13:01.317902Z",
                    "filename": "zap",
                    "sha1": "a7a9c12205f9cb1f53f8b6678265c9e8158f2a8f",
                    "size": 4,
                },
            },
        }

        assert manifest.read() == expected

        # Deletion works:
        manifest.delete("fake://foo")
        expected["files"].pop("fake://foo")
        assert manifest.read() == expected

    def test_same_sha(self):
        """Stand-alone release file has same sha1 as one in manifest"""
        self.create_archive(fields={}, files={"foo": "bar"})
        file_ = File.objects.create()
        file_.putfile(BytesIO(b"bar"))
        self.create_release_file(file=file_)

        manifest = ReleaseManifest(self.release, None)._manifest.readable_data()
        assert file_.checksum == manifest["files"]["fake://foo"]["sha1"]
