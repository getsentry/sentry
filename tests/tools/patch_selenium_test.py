import os
import re
import sys
from unittest import mock

from tools import patch_selenium

if sys.version_info >= (3, 11):
    from contextlib import chdir
else:
    import contextlib

    @contextlib.contextmanager
    def chdir(s):
        orig = os.getcwd()
        os.chdir(s)
        try:
            yield
        finally:
            os.chdir(orig)


def test_patching_from_getsentry(capsys, tmp_path):
    # simulate a set of patches, and patching from `getsentry`

    tmp_path.joinpath("sentry/tools").mkdir(parents=True)

    patch = """\
--- f1
+++ f1,bak
@@ -1 +1 @@
-hello
+hello hello
"""

    scripts_patches_dir = tmp_path.joinpath("sentry/scripts/patches")
    scripts_patches_dir.mkdir(parents=True)
    scripts_patches_dir.joinpath("patch1.patch").write_text(patch)

    getsentry_dir = tmp_path.joinpath("getsentry")
    getsentry_dir.mkdir()
    getsentry_dir.joinpath("tools").symlink_to("../sentry/tools")
    getsentry_dir.joinpath("f1").write_text("hello\n")

    fake_file = str(getsentry_dir.joinpath("tools/patch_selenium.py"))

    fake_patches = (
        (
            "scripts/patches/patch1.patch",
            "f1",
            re.compile(r"^hello$"),
        ),
    )

    with mock.patch.multiple(patch_selenium, __file__=fake_file, PATCH_FILE_PATTERN=fake_patches):
        with chdir(getsentry_dir):
            assert patch_selenium.main() == 0

    assert getsentry_dir.joinpath("f1").read_text() == "hello hello\n"
    out, _ = capsys.readouterr()
    assert out == "patching f1, you will only see this once\n"
