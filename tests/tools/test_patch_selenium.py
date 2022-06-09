import os
import re
import sys
from unittest import mock

import pytest

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


@pytest.fixture
def getsentry_setup(tmp_path):
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
        yield tmp_path


def test_patching_from_getsentry(capsys, getsentry_setup):
    with chdir(getsentry_setup.joinpath("getsentry")):
        assert patch_selenium.main() == 0

    assert getsentry_setup.joinpath("getsentry/f1").read_text() == "hello hello\n"
    out, _ = capsys.readouterr()
    assert out == "patching f1, you will only see this once\n"


def test_patching_from_getsentry_called_in_sentry(capsys, getsentry_setup):
    # getsentry *also* calls this script from sentry when setting itself up
    with chdir(getsentry_setup.joinpath("sentry")):
        assert patch_selenium.main() == 0

    out, _ = capsys.readouterr()
    assert out == "patch_selenium: ignoring f1 (does not exist)\n"
