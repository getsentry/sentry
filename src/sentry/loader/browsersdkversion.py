import functools
import logging
import os
import re

from django.conf import settings
from pkg_resources import parse_version

import sentry
from sentry.utils import json
from sentry.utils.compat import map

logger = logging.getLogger("sentry")

_version_regexp = re.compile(r"^\d+\.\d+\.\d+$")  # We really only want stable releases
LOADER_FOLDER = os.path.abspath(os.path.join(os.path.dirname(sentry.__file__), "loader"))


@functools.lru_cache(maxsize=10)
def load_registry(path):
    if "/" in path:
        return None
    fn = os.path.join(LOADER_FOLDER, path + ".json")
    try:
        with open(fn, "rb") as f:
            return json.load(f)
    except OSError:
        return None


def get_highest_browser_sdk_version(versions):
    full_versions = [x for x in versions if _version_regexp.match(x)]
    return (
        str(max(map(parse_version, full_versions)))
        if full_versions
        else settings.JS_SDK_LOADER_SDK_VERSION
    )


def get_browser_sdk_version_versions():
    return ["latest", "6.x", "5.x", "4.x"]


def get_browser_sdk_version_choices():
    rv = []
    for version in get_browser_sdk_version_versions():
        rv.append((version, version))
    return tuple(rv)


def load_version_from_file():
    data = load_registry("_registry")
    if data:
        return data.get("versions", [])
    return []


def get_highest_selected_browser_sdk_version(selected_version):
    versions = load_version_from_file()
    if selected_version == "latest":
        return get_highest_browser_sdk_version(versions)
    return get_highest_browser_sdk_version(
        [x for x in versions if x.startswith(selected_version[0])]
    )


def get_browser_sdk_version(project_key):
    selected_version = get_selected_browser_sdk_version(project_key)

    try:
        return get_highest_selected_browser_sdk_version(selected_version)
    except Exception:
        logger.error("error occurred while trying to read js sdk information from the registry")
        return settings.JS_SDK_LOADER_SDK_VERSION


def get_selected_browser_sdk_version(project_key):
    return project_key.data.get("browserSdkVersion") or get_default_sdk_version_for_project(
        project_key.project
    )


def get_default_sdk_version_for_project(project):
    return project.get_option("sentry:default_loader_version")
