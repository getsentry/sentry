import errno
import os
from io import BytesIO
from zipfile import ZipFile

from sentry import options
from sentry.models import ReleaseArchive, ReleaseFile, merge_release_archives
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
    @staticmethod
    def create_archive(fields, files, raw=False):
        manifest = dict(
            fields, files={filename: {"url": f"fake://{filename}"} for filename in files}
        )
        buffer = BytesIO()
        with ZipFile(buffer, mode="w") as zf:
            zf.writestr("manifest.json", json.dumps(manifest))
            for filename, content in files.items():
                zf.writestr(filename, content)

        return buffer if raw else ReleaseArchive(buffer)

    def test_merge(self):
        archive1 = self.create_archive(
            fields={
                "org": 1,
                "release": 2,
                "dist": 3,
            },
            files={
                "foo": "foo",
                "bar": "bar",
                "baz": "baz",
            },
            raw=True,
        )
        archive2 = self.create_archive(
            fields={
                "org": 1,
                "release": 666,
                "dist": 3,
            },
            files={
                "foo": "foo",
                "bar": "BAR",
            },
        )

        buffer = BytesIO()
        merge_release_archives(archive1, archive2, buffer)

        archive3 = ReleaseArchive(buffer)

        assert archive3.manifest["org"] == 1
        assert archive3.manifest["release"] == 2
        assert archive3.manifest["dist"] == 3

        assert archive3.manifest["files"].keys() == {"foo", "bar", "baz"}

        # Make sure everything was saved:
        peristed_manifest = archive3._read_manifest()
        assert peristed_manifest == archive3.manifest

        assert archive3.read("foo") == b"foo"
        assert archive3.read("bar") == b"bar"
        assert archive3.read("baz") == b"baz"
