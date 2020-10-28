from __future__ import absolute_import

import errno
import os
import six

from sentry import options
from sentry.models import ReleaseFile
from sentry.testutils import TestCase


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
        file.putfile(six.BytesIO(file_content))
        release_file = self.create_release_file(file=file)

        expected_path = os.path.join(
            options.get("releasefile.cache-path"),
            six.text_type(self.organization.id),
            six.text_type(file.id),
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
        file.putfile(six.BytesIO(file_content))
        release_file = self.create_release_file(file=file)

        expected_path = os.path.join(
            options.get("releasefile.cache-path"),
            six.text_type(self.organization.id),
            six.text_type(file.id),
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
