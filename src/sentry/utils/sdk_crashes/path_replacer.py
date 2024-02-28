import re
from abc import ABC, abstractmethod


class PathReplacer(ABC):
    """
    Replaces SDK frame paths with a new path. Runs only for SDK frames.
    """

    @abstractmethod
    def replace_path(self, path_field: str, path_value: str) -> str | None:
        pass


class FixedPathReplacer(PathReplacer):
    def __init__(
        self,
        path: str,
    ):
        self.path = path

    def replace_path(self, path_field: str, path_value: str) -> str | None:
        return self.path


class KeepAfterPatternMatchPathReplacer(PathReplacer):
    """
    Replaces the path with the part of the path after the first pattern match.

    For example, if the pattern is `/sentry/.*` and the path is `/Users/sentry/myfile.js` then the path will be replaced with `/sentry/myfile.js`.

    :param patterns: A set of regular expressions.
    :param fallback_path: The path to use if no pattern matches.
    """

    def __init__(
        self,
        patterns: set[str],
        fallback_path: str,
    ):
        self.patterns = {re.compile(element, re.IGNORECASE) for element in patterns}
        self.fallback_path = fallback_path

    def replace_path(self, path_field: str, path_value: str) -> str | None:
        for pattern in self.patterns:
            match = pattern.search(path_value)
            if match:
                return path_value[match.start() :]
        return self.fallback_path


class KeepFieldPathReplacer(PathReplacer):
    def __init__(self, fields: set[str]):
        self.fields = fields

    def replace_path(self, path_field: str, path_value: str) -> str | None:
        if path_field in self.fields:
            return path_value
        return None
