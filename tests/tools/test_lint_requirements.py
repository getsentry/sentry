import pytest

from tools import lint_requirements


def test_ok(tmp_path):
    f = tmp_path.joinpath("f.txt")
    f.write_text(
        "# allow comments\n"
        "# and allow pip settings\n"
        "--index-url https://pypi.devinfra.sentry.io/simple\n"
        "a==1\n"
        "b==2\n"
    )
    assert lint_requirements.main((str(f),)) == 0


def test_not_ok_classic_git_url(tmp_path):
    f = tmp_path.joinpath("f.txt")
    f.write_text("git+https://github.com/asottile/astpretty@3.0.0#egg=astpretty")

    with pytest.raises(SystemExit) as excinfo:
        lint_requirements.main((str(f),))

    expected = f"""\
You cannot use dependencies that are not on PyPI directly.
See PEP440: https://www.python.org/dev/peps/pep-0440/#direct-references

{f}:1: git+https://github.com/asottile/astpretty@3.0.0#egg=astpretty
"""
    (msg,) = excinfo.value.args
    assert msg == expected.rstrip()


def test_not_ok_new_style_git_url(tmp_path):
    f = tmp_path.joinpath("f.txt")
    f.write_text("astpretty @ git+https://github.com/asottile/astpretty@3.0.0")

    with pytest.raises(SystemExit) as excinfo:
        lint_requirements.main((str(f),))

    expected = f"""\
You cannot use dependencies that are not on PyPI directly.
See PEP440: https://www.python.org/dev/peps/pep-0440/#direct-references

{f}:1: astpretty @ git+https://github.com/asottile/astpretty@3.0.0
"""
    (msg,) = excinfo.value.args
    assert msg == expected.rstrip()
