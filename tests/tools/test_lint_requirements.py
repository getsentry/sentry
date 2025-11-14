from typing import int
import pytest

from tools import lint_requirements


def test_ok(tmp_path) -> None:
    f = tmp_path.joinpath("uv.lock")
    f.write_text(
        """
[[package]]
name = "amqp"
version = "5.3.1"
source = { registry = "https://pypi.devinfra.sentry.io/simple" }
dependencies = [
    { name = "vine", marker = "sys_platform == 'darwin' or sys_platform == 'linux'" },
]
wheels = [
    { url = "https://pypi.devinfra.sentry.io/wheels/amqp-5.3.1-py3-none-any.whl", hash = "sha256:43b3319e1b4e7d1251833a93d672b4af1e40f3d632d479b98661a95f117880a2" },
]
"""
    )
    assert lint_requirements.main((str(f),)) == 0


def test_not_ok_git_url(tmp_path) -> None:
    # note: uv adding
    # git+https://github.com/asottile/astpretty@3.0.0#egg=astpretty
    # vs astpretty @ git+https://github.com/asottile/astpretty@v3.0.0
    # ...results in the same source = { git = ...
    f = tmp_path.joinpath("uv.lock")
    f.write_text(
        """
[[package]]
name = "astpretty"
version = "3.0.0"
source = { git = "https://github.com/asottile/astpretty?rev=v3.0.0#472be812174a2c883ee8e1cab5935e8c32c3a44f" }
"""
    )

    with pytest.raises(SystemExit) as excinfo:
        lint_requirements.main((str(f),))

    expected = f"""
The specifier for package astpretty in {f} isn't allowed:

You cannot use dependencies that are not on internal pypi.

You also cannot use non-specifier requirements.
See PEP440: https://www.python.org/dev/peps/pep-0440/#direct-references"""
    (msg,) = excinfo.value.args
    assert msg == expected.rstrip()


def test_not_ok_public_pypi(tmp_path) -> None:
    # note: uv adding
    # git+https://github.com/asottile/astpretty@3.0.0#egg=astpretty
    # vs astpretty @ git+https://github.com/asottile/astpretty@v3.0.0
    # ...results in the same source = { git = ...
    f = tmp_path.joinpath("uv.lock")
    f.write_text(
        """
[[package]]
name = "amqp"
version = "5.3.1"
source = { registry = "https://pypi.org/simple" }
dependencies = [
    { name = "vine", marker = "sys_platform == 'darwin' or sys_platform == 'linux'" },
]
wheels = [
    { url = "https://files.pythonhosted.org/packages/26/99/fc813cd978842c26c82534010ea849eee9ab3a13ea2b74e95cb9c99e747b/amqp-5.3.1-py3-none-any.whl", hash = "sha256:43b3319e1b4e7d1251833a93d672b4af1e40f3d632d479b98661a95f117880a2", size = 50944, upload-time = "2024-11-12T19:55:41.782Z" },
]
"""
    )

    with pytest.raises(SystemExit) as excinfo:
        lint_requirements.main((str(f),))

    expected = f"""
The specifier for package amqp in {f} isn't allowed:

You cannot use dependencies that are not on internal pypi.

You also cannot use non-specifier requirements.
See PEP440: https://www.python.org/dev/peps/pep-0440/#direct-references"""
    (msg,) = excinfo.value.args
    assert msg == expected.rstrip()
