import re

from tools.mypy_helpers.check_stronglist import _glob_to_re, main


def test_glob_to_re_exact_matches():
    pat = re.compile(_glob_to_re("a.b.c"))
    assert pat.fullmatch("a.b.c")
    assert not pat.fullmatch("a.b.c.d")
    assert not pat.fullmatch("a_b_c")


def test_glob_to_re_wildcards():
    pat = re.compile(_glob_to_re("a.b.c.*"))
    assert pat.fullmatch("a.b.c")
    assert pat.fullmatch("a.b.c.d")
    assert not pat.fullmatch("a_b_c")


def test_ok(tmp_path):
    src = """\
[[tool.mypy.overrides]]
module = ["a.b.c", "d.e.f", "g.h.i"]
disable_error_code = ["misc"]

[[tool.mypy.overrides]]
module = ["j.k.*"]
disallow_untyped_defs = true
"""
    f = tmp_path.joinpath("f")
    f.write_text(src)

    tmp_path.joinpath("j/k").mkdir(parents=True)
    tmp_path.joinpath("j/k/l.py").touch()

    assert main((str(f),)) == 0


def test_errors_on_exact_module(tmp_path, capsys):
    src = """\
[[tool.mypy.overrides]]
module = ["a.b.c", "d.e.f", "g.h.i"]
disable_error_code = ["misc"]

[[tool.mypy.overrides]]
module = ["a.b.c", "d.e.f"]
disallow_untyped_defs = true
"""
    f = tmp_path.joinpath("f")
    f.write_text(src)

    tmp_path.joinpath("a/b").mkdir(parents=True)
    tmp_path.joinpath("a/b/c.py").touch()
    tmp_path.joinpath("d/e").mkdir(parents=True)
    tmp_path.joinpath("d/e/f.py").touch()

    assert main((str(f),)) == 1

    expected = f"""\
{f}: a.b.c is in the typing errors allowlist *and* stronglist
{f}: d.e.f is in the typing errors allowlist *and* stronglist
"""
    assert capsys.readouterr().out == expected


def test_errors_on_globbed_module(tmp_path, capsys):
    src = """\
[[tool.mypy.overrides]]
module = ["a.b.c", "a.b.c.d", "a.b.c.e"]
disable_error_code = ["misc"]

[[tool.mypy.overrides]]
module = ["a.b.c.*"]
disallow_untyped_defs = true
"""
    f = tmp_path.joinpath("f")
    f.write_text(src)

    tmp_path.joinpath("a/b/c").mkdir(parents=True)
    tmp_path.joinpath("a/b/c/d.py").touch()

    assert main((str(f),)) == 1

    expected = f"""\
{f}: a.b.c is in the typing errors allowlist *and* stronglist
{f}: a.b.c.d is in the typing errors allowlist *and* stronglist
{f}: a.b.c.e is in the typing errors allowlist *and* stronglist
"""
    assert capsys.readouterr().out == expected


def test_stronglist_existence_file_missing(tmp_path, capsys):
    src = """\
[[tool.mypy.overrides]]
module = []
disable_error_code = ["misc"]

[[tool.mypy.overrides]]
module = ["a.b"]
disallow_untyped_defs = true
"""
    f = tmp_path.joinpath("f")
    f.write_text(src)

    assert main((str(f),)) == 1

    expected = f"""\
{f}: a.b in stronglist does not match any files!
"""
    assert capsys.readouterr().out == expected


def test_stronglist_existence_glob_missing(tmp_path, capsys):
    src = """\
[[tool.mypy.overrides]]
module = []
disable_error_code = ["misc"]

[[tool.mypy.overrides]]
module = ["a.*"]
disallow_untyped_defs = true
"""
    f = tmp_path.joinpath("f")
    f.write_text(src)

    assert main((str(f),)) == 1

    expected = f"""\
{f}: a.* in stronglist does not match any files!
"""
    assert capsys.readouterr().out == expected


def test_stronglist_existence_ok_src_layout(tmp_path):
    src = """\
[[tool.mypy.overrides]]
module = []
disable_error_code = ["misc"]

[[tool.mypy.overrides]]
module = ["a.b"]
disallow_untyped_defs = true
"""
    f = tmp_path.joinpath("f")
    f.write_text(src)

    tmp_path.joinpath("src/a").mkdir(parents=True)
    tmp_path.joinpath("src/a/b.py").touch()

    assert main((str(f),)) == 0


def test_stronglist_existence_ok_glob(tmp_path):
    src = """\
[[tool.mypy.overrides]]
module = []
disable_error_code = ["misc"]

[[tool.mypy.overrides]]
module = ["a.*"]
disallow_untyped_defs = true
"""
    f = tmp_path.joinpath("f")
    f.write_text(src)

    tmp_path.joinpath("a").mkdir(parents=True)
    tmp_path.joinpath("a/c.py").touch()

    assert main((str(f),)) == 0


def test_stronglist_existince_ok_init_py(tmp_path):
    src = """\
[[tool.mypy.overrides]]
module = []
disable_error_code = ["misc"]

[[tool.mypy.overrides]]
module = ["a.b"]
disallow_untyped_defs = true
"""
    f = tmp_path.joinpath("f")
    f.write_text(src)

    tmp_path.joinpath("a/b").mkdir(parents=True)
    tmp_path.joinpath("a/b/__init__.py").touch()

    assert main((str(f),)) == 0
