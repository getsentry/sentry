from __future__ import annotations

import pathlib
from typing import Generator
from unittest import mock

import pytest
from django.conf import settings

from sentry.utils import assets


@pytest.fixture(autouse=True)
def reset_cache() -> Generator[None, None, None]:
    # https://github.com/python/mypy/issues/5107
    assets._frontend_versions.cache_clear()  # type: ignore[attr-defined]
    yield
    assets._frontend_versions.cache_clear()  # type: ignore[attr-defined]


@pytest.fixture
def self_hosted(tmp_path: pathlib.Path) -> Generator[None, None, None]:
    with mock.patch.object(settings, "STATIC_FRONTEND_APP_URL", "/_static/dist/"):
        conf_dir = tmp_path.joinpath("conf")
        conf_dir.mkdir()
        with mock.patch.object(settings, "CONF_DIR", conf_dir):
            yield


@pytest.fixture
def getsentry_no_configmap(tmp_path: pathlib.Path) -> Generator[None, None, None]:
    # shouldn't actually happen -- but make sure it still works!
    with mock.patch.object(
        settings, "STATIC_FRONTEND_APP_URL", "https://static.example.com/_static/dist/"
    ):
        conf_dir = tmp_path.joinpath("conf")
        conf_dir.mkdir()
        with mock.patch.object(settings, "CONF_DIR", conf_dir):
            yield


@pytest.fixture
def getsentry(tmp_path: pathlib.Path) -> Generator[None, None, None]:
    with mock.patch.object(
        settings, "STATIC_FRONTEND_APP_URL", "https://static.example.com/_static/dist/"
    ):
        conf_dir = tmp_path.joinpath("conf")
        conf_dir.mkdir()
        conf_dir.joinpath("settings/frontend").mkdir(parents=True)
        conf_dir.joinpath("settings/frontend/frontend-versions.json").write_text(
            '{"app.js": "app-deadbeef.js", "app.css": "app-cafecafe.css"}'
        )
        with mock.patch.object(settings, "CONF_DIR", conf_dir):
            yield


@pytest.mark.usefixtures("self_hosted")
def test_frontend_app_asset_url_self_hosted() -> None:
    ret = assets.get_frontend_app_asset_url("sentry", "entrypoints/app.js")
    assert ret == "/_static/dist/sentry/entrypoints/app.js"


@pytest.mark.usefixtures("getsentry_no_configmap")
def test_frontend_app_asset_url_getsentry_no_configmap() -> None:
    ret = assets.get_frontend_app_asset_url("sentry", "entrypoints/app.js")
    assert ret == "https://static.example.com/_static/dist/sentry/entrypoints/app.js"


@pytest.mark.usefixtures("getsentry")
def test_frontend_app_asset_url_getsentry() -> None:
    ret = assets.get_frontend_app_asset_url("sentry", "entrypoints/app.js")
    assert (
        ret == "https://static.example.com/_static/dist/sentry/entrypoints-hashed/app-deadbeef.js"
    )
