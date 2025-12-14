from __future__ import annotations

import re
from abc import ABC, abstractmethod
from collections.abc import Mapping, Sequence
from typing import Any

from sentry.integrations.source_code_management.repo_trees import get_extension

from .constants import STACK_ROOT_MAX_LEVEL
from .errors import (
    DoesNotFollowJavaPackageNamingConvention,
    MissingModuleOrAbsPath,
    NeedsExtension,
    UnsupportedFrameInfo,
)
from .utils.platform import PlatformConfig

NOT_FOUND = -1

# Regex pattern for unsupported frame paths
UNSUPPORTED_FRAME_PATH_PATTERN = re.compile(r"^[\[<]|https?://", re.IGNORECASE)


def create_frame_info(frame: Mapping[str, Any], platform: str | None = None) -> FrameInfo:
    """Factory function to create the appropriate FrameInfo instance."""
    if platform:
        platform_config = PlatformConfig(platform)
        if platform_config.extracts_filename_from_module():
            return ModuleBasedFrameInfo(frame)

    return PathBasedFrameInfo(frame)


class FrameInfo(ABC):
    raw_path: str
    normalized_path: str
    stack_root: str

    def __init__(self, frame: Mapping[str, Any]) -> None:
        self.process_frame(frame)

    def __repr__(self) -> str:
        return f"FrameInfo: {self.raw_path} stack_root: {self.stack_root}"

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, FrameInfo):
            return False
        return self.raw_path == other.raw_path

    @abstractmethod
    def process_frame(self, frame: Mapping[str, Any]) -> None:
        """Process the frame and set the necessary attributes."""
        raise NotImplementedError("Subclasses must implement process_frame")


class ModuleBasedFrameInfo(FrameInfo):
    def process_frame(self, frame: Mapping[str, Any]) -> None:
        if frame.get("module") and frame.get("abs_path"):
            stack_root, filepath = get_path_from_module(frame["module"], frame["abs_path"])
            self.stack_root = stack_root
            self.raw_path = filepath
            self.normalized_path = filepath
        else:
            raise MissingModuleOrAbsPath("Investigate why the data is missing.")


class PathBasedFrameInfo(FrameInfo):
    def process_frame(self, frame: Mapping[str, Any]) -> None:
        frame_file_path = frame["filename"]
        frame_file_path = self.transformations(frame_file_path)

        # We normalize the path to be as close to what the path would
        # look like in the source code repository, hence why we remove
        # the straight path prefix and drive letter
        self.normalized_path, removed_prefix = remove_prefixes(frame_file_path)

        if not frame_file_path or UNSUPPORTED_FRAME_PATH_PATTERN.search(frame_file_path):
            raise UnsupportedFrameInfo("This path is not supported.")

        if not get_extension(frame_file_path):
            raise NeedsExtension("It needs an extension.")

        if frame_file_path.startswith("/"):
            self.stack_root = f"/{self.normalized_path.split('/')[0]}/"
        else:
            self.stack_root = removed_prefix + self.normalized_path.split("/")[0]

    def transformations(self, frame_file_path: str) -> str:
        self.raw_path = frame_file_path

        is_windows_path = False
        if "\\" in frame_file_path:
            is_windows_path = True
            frame_file_path = frame_file_path.replace("\\", "/")

        # Remove drive letter if it exists
        if is_windows_path and frame_file_path[1] == ":":
            frame_file_path = frame_file_path[2:]
            # windows drive letters can be like C:\ or C:
            # so we need to remove the slash if it exists
            if frame_file_path[0] == "/":
                frame_file_path = frame_file_path[1:]

        return frame_file_path


PREFIXES_TO_REMOVE = ["app:///", "./", "../", "/"]


# XXX: This will eventually replace get_straight_path_prefix_end_index
def remove_prefixes(frame_file_path: str) -> tuple[str, str]:
    """
    This function removes known prefixes to get a path as close to what the path would
    look like in the source code repository.
    """
    removed_prefix = ""
    for prefix in PREFIXES_TO_REMOVE:
        if frame_file_path.startswith(prefix):
            frame_file_path = frame_file_path.replace(prefix, "", 1)
            frame_file_path, recursive_removed_prefix = remove_prefixes(frame_file_path)
            removed_prefix += prefix + recursive_removed_prefix

    return frame_file_path, removed_prefix


# Based on # https://github.com/getsentry/symbolicator/blob/450f1d6a8c346405454505ed9ca87e08a6ff34b7/crates/symbolicator-proguard/src/symbolication.rs#L450-L485
def get_path_from_module(module: str, abs_path: str) -> tuple[str, str]:
    """This attempts to generate a modified module and a real path from a Java module name and filename.
    Returns a tuple of (stack_root, source_path).
    """
    # An `abs_path` is valid if it contains a `.` and doesn't contain a `$`.
    if "$" in abs_path or "." not in abs_path:
        # Split the module at the first '$' character and take the part before it
        # If there's no '$', use the entire module
        file_path = module.split("$", 1)[0] if "$" in module else module
        stack_root = module.rsplit(".", 1)[0].replace(".", "/") + "/"
        return stack_root, file_path.replace(".", "/")

    if "." not in module:
        raise DoesNotFollowJavaPackageNamingConvention

    # Gets rid of the class name
    parts = module.rsplit(".", 1)[0].split(".")
    dirpath = "/".join(parts)
    granularity = get_granularity(parts)

    stack_root = "/".join(parts[:granularity]) + "/"
    file_path = f"{dirpath}/{abs_path}"
    return stack_root, file_path


def get_granularity(parts: Sequence[str]) -> int:
    # a.Bar, Bar.kt -> stack_root: a/, file_path: a/Bar.kt
    granularity = 1

    if len(parts) > 1:
        # com.example.foo.bar.Baz$InnerClass, Baz.kt ->
        #    stack_root: com/example/foo/bar/
        #    file_path:  com/example/foo/bar/Baz.kt
        # uk.co.example.foo.bar.Baz$InnerClass, Baz.kt ->
        #    stack_root: uk/co/example/foo/
        #    file_path:  uk/co/example/foo/bar/Baz.kt
        # com.example.multi.foo.bar.Baz$InnerClass, Baz.kt ->
        #    stack_root: com/example/multi/foo/
        #    file_path:  com/example/multi/foo/bar/Baz.kt
        granularity = STACK_ROOT_MAX_LEVEL

    return granularity
