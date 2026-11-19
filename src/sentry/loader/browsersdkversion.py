import functools
import logging
import os
import re
from collections.abc import Sequence
from typing import TYPE_CHECKING, TypedDict, cast

import orjson
from django.conf import settings
from packaging.version import Version

import sentry

if TYPE_CHECKING:
    from sentry.models.project import Project
    from sentry.models.projectkey import ProjectKey

logger = logging.getLogger("sentry")

_version_regexp = re.compile(r"^\d+\.\d+\.\d+$")  # We really only want stable releases
LOADER_FOLDER = os.path.abspath(os.path.join(os.path.dirname(sentry.__file__), "loader"))


class _SDKRegistry(TypedDict, total=False):
    versions: list[str]


@functools.lru_cache(maxsize=10)
def load_registry(path: str) -> _SDKRegistry | None:
    if "/" in path:
        return None
    fn = os.path.join(LOADER_FOLDER, path + ".json")
    try:
        with open(fn, "rb") as f:
            return cast("_SDKRegistry", orjson.loads(f.read()))
    except OSError:
        return None


def get_highest_browser_sdk_version(versions: Sequence[str]) -> Version:
    full_versions = [x for x in versions if _version_regexp.match(x)]
    return (
        max(map(Version, full_versions))
        if full_versions
        else Version(settings.JS_SDK_LOADER_SDK_VERSION)
    )


def get_all_browser_sdk_version_versions() -> list[str]:
    return ["latest", "11.x", "10.x", "9.x", "8.x", "7.x", "6.x", "5.x", "4.x"]


def get_all_browser_sdk_version_choices() -> tuple[tuple[str, str], ...]:
    versions = get_all_browser_sdk_version_versions()

    rv = []
    for version in versions:
        rv.append((version, version))
    return tuple(rv)


def get_browser_sdk_version_choices(project: "Project") -> tuple[tuple[str, str], ...]:
    versions = get_available_sdk_versions_for_project(project)

    rv = []
    for version in versions:
        rv.append((version, version))
    return tuple(rv)


def load_version_from_file() -> list[str]:
    data = load_registry("_registry")
    if data:
        return data.get("versions", [])
    return []


def match_selected_version_to_browser_sdk_version(selected_version: str) -> Version:
    versions = load_version_from_file()
    if selected_version == "latest":
        # "latest" as an option is phased out before the v8 release of the JS SDK, meaning that we pin people to the latest pre-v8-version when they have "latest" selected
        return get_highest_browser_sdk_version([x for x in versions if Version(x) < Version("8")])
    return get_highest_browser_sdk_version(
        # Filter for all versions that match the selected versions major
        [x for x in versions if x.split(".")[0] == selected_version.split(".")[0]]
    )


def get_browser_sdk_version(project_key: "ProjectKey") -> Version:
    selected_version = get_selected_browser_sdk_version(project_key)

    try:
        return match_selected_version_to_browser_sdk_version(selected_version)
    except Exception:
        logger.exception("error occurred while trying to read js sdk information from the registry")
        return Version(settings.JS_SDK_LOADER_SDK_VERSION)


def get_selected_browser_sdk_version(project_key: "ProjectKey") -> str:
    return cast(
        str,
        project_key.data.get("browserSdkVersion")
        or get_default_sdk_version_for_project(project_key.project),
    )


def get_default_sdk_version_for_project(project: "Project") -> str:
    version = project.get_option("sentry:default_loader_version")
    return version


def get_available_sdk_versions_for_project(project: "Project") -> list[str]:
    versions = project.get_option("sentry:loader_available_sdk_versions")
    return versions
