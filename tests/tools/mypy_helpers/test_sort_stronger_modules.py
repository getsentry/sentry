from pathlib import Path

from tools.mypy_helpers.sort_stronger_modules import main


def test_sort_stronger_modules(tmp_path: Path) -> None:
    src = """\
# before

# begin: not yet strongly typed
[[tool.mypy.overrides]]
module = [
    "mod2",
    "mod1",
    "mod3",
]
some_setting = true
# end: not yet strongly typed

# after
"""
    expected = """\
# before

# begin: not yet strongly typed
[[tool.mypy.overrides]]
module = [
    "mod1",
    "mod2",
    "mod3",
]
some_setting = true
# end: not yet strongly typed

# after
"""

    f = tmp_path.joinpath("f")
    f.write_text(src)

    assert main((str(f),)) == 1

    assert f.read_text() == expected

    assert main((str(f),)) == 0


def test_removes_duplicates(tmp_path: Path) -> None:
    src = """\
# begin: not yet strongly typed
[[tool.mypy.overrides]]
module = [
    "mod1",
    "mod1",
]
some_setting = true
# end: not yet strongly typed
"""
    expected = """\
# begin: not yet strongly typed
[[tool.mypy.overrides]]
module = [
    "mod1",
]
some_setting = true
# end: not yet strongly typed
"""
    f = tmp_path.joinpath("f")
    f.write_text(src)

    assert main((str(f),)) == 1

    assert f.read_text() == expected
