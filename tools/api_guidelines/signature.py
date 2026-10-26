from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path, PurePosixPath

from tools.api_guidelines.rules import ApiRule

# Scope for code that isn't inside a function, matching the flake8's convention
MODULE_SCOPE = "<module>"

_REPO_ROOT = PurePosixPath(Path(__file__).resolve().parents[2].as_posix())
_REPO_DIRS = ("/src/", "/tools/", "/tests/", "/fixtures/")


@dataclass(frozen=True)
class BaselineSignature:
    """Identifies one API lint violation the same way in every tool.

    Build it with signature_of(), never directly, so every field is normalized
    """

    rule: ApiRule
    path: str
    scope: str
    key: str | None


def normalize_path(path: str) -> str:
    """Repo-relative path, forward-slash form of a file path."""
    normalized = path.replace("\\", "/")

    # check if this is an absolute path
    if normalized.startswith("/"):
        try:
            return PurePosixPath(normalized).relative_to(_REPO_ROOT).as_posix()
        except ValueError:
            # if the path is not relative to the repo root, try to find the first repo dir in the path and return the path relative to that
            starting_index = []
            for directory in _REPO_DIRS:
                directory_index = normalized.find(directory)
                if directory_index != -1:
                    starting_index.append(directory_index)

            if starting_index:
                earliest_index = min(starting_index)
                # remove the path up to and including the first repo dir in the path
                return normalized[earliest_index + 1 :]
            return normalized

    return normalized.removeprefix("./")


def signature_of(
    rule: ApiRule | str, path: str, scope: str | None, key: str | None = None
) -> BaselineSignature:
    """The only way to build a BaselineSignature.

    Normalizes each field, so two descriptions of the same violation always
    produce equal signatures. Raises ValueError for an unknown rule code.
    """
    return BaselineSignature(
        rule=ApiRule(rule),
        path=normalize_path(path),
        scope=scope or MODULE_SCOPE,
        key=key or None,
    )
