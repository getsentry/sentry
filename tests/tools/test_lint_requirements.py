import json
from unittest.mock import patch

import pytest

from tools import lint_requirements


def test_ok_pypi_org(tmp_path) -> None:
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
    { url = "https://files.pythonhosted.org/packages/26/99/amqp-5.3.1-py3-none-any.whl", hash = "sha256:43b3319e1b4e7d1251833a93d672b4af1e40f3d632d479b98661a95f117880a2" },
]
"""
    )
    assert lint_requirements.main((str(f),)) == 0


def test_ok_internal_pypi_no_upstream_wheels(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(lint_requirements, "_has_upstream_cp313_wheels", lambda name, ver: False)
    f = tmp_path.joinpath("uv.lock")
    f.write_text(
        """
[[package]]
name = "hiredis"
version = "2.3.2"
source = { registry = "https://pypi.devinfra.sentry.io/simple" }
wheels = [
    { url = "https://pypi.devinfra.sentry.io/wheels/hiredis-2.3.2-cp313-cp313-manylinux2014_x86_64.whl", hash = "sha256:abcd" },
]
"""
    )
    assert lint_requirements.main((str(f),)) == 0


def test_ok_internal_pypi_network_unavailable(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(lint_requirements, "_has_upstream_cp313_wheels", lambda name, ver: None)
    f = tmp_path.joinpath("uv.lock")
    f.write_text(
        """
[[package]]
name = "hiredis"
version = "2.3.2"
source = { registry = "https://pypi.devinfra.sentry.io/simple" }
wheels = [
    { url = "https://pypi.devinfra.sentry.io/wheels/hiredis-2.3.2-cp313-cp313-manylinux2014_x86_64.whl", hash = "sha256:abcd" },
]
"""
    )
    assert lint_requirements.main((str(f),)) == 0


def test_not_ok_internal_pypi_has_upstream_wheels(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(lint_requirements, "_has_upstream_cp313_wheels", lambda name, ver: True)
    f = tmp_path.joinpath("uv.lock")
    f.write_text(
        """
[[package]]
name = "xmlsec"
version = "1.3.17"
source = { registry = "https://pypi.devinfra.sentry.io/simple" }
wheels = [
    { url = "https://pypi.devinfra.sentry.io/wheels/xmlsec-1.3.17-cp313-cp313-manylinux2014_x86_64.whl", hash = "sha256:abcd" },
]
"""
    )
    with pytest.raises(SystemExit) as excinfo:
        lint_requirements.main((str(f),))

    expected = f"""
Package xmlsec==1.3.17 in {f} is sourced from internal
PyPI but upstream PyPI already has cp313 wheels for macOS arm64 and/or Linux
x86_64. Remove it from [tool.uv.sources] and no-build-package in pyproject.toml
so it is fetched from pypi.org directly."""
    (msg,) = excinfo.value.args
    assert msg == expected.rstrip()


def _has_wheels(filenames: list[str]) -> bool | None:
    import io

    payload = json.dumps(
        {"urls": [{"packagetype": "bdist_wheel", "filename": fn} for fn in filenames]}
    ).encode()

    class FakeResp(io.BytesIO):
        def __enter__(self):
            return self

        def __exit__(self, *a):
            pass

    with patch("urllib.request.urlopen", return_value=FakeResp(payload)):
        return lint_requirements._has_upstream_cp313_wheels("pkg", "1.0")


def test_has_upstream_wheels_both_platforms() -> None:
    assert (
        _has_wheels(
            [
                "pkg-1.0-cp313-cp313-macosx_11_0_arm64.whl",
                "pkg-1.0-cp313-cp313-manylinux2014_x86_64.whl",
            ]
        )
        is True
    )


def test_has_upstream_wheels_pure_python() -> None:
    assert _has_wheels(["pkg-1.0-py3-none-any.whl"]) is True


def test_has_upstream_wheels_mac_only() -> None:
    # only mac — linux installs would still need internal PyPI
    assert _has_wheels(["pkg-1.0-cp313-cp313-macosx_11_0_arm64.whl"]) is False


def test_has_upstream_wheels_linux_only() -> None:
    # only linux — mac installs would still need internal PyPI
    assert _has_wheels(["pkg-1.0-cp313-cp313-manylinux2014_x86_64.whl"]) is False


def test_has_upstream_wheels_none() -> None:
    assert _has_wheels([]) is False


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

Packages must come from pypi.org or the internal Sentry PyPI
(https://pypi.devinfra.sentry.io/simple) for packages that lack
suitable upstream wheels. URL/VCS/local dependencies are not allowed.
See PEP440: https://www.python.org/dev/peps/pep-0440/#direct-references"""
    (msg,) = excinfo.value.args
    assert msg == expected.rstrip()
