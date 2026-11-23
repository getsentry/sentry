from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path, PurePosixPath

from tools.api_guidelines.rules import ApiRule

_REPO_ROOT = PurePosixPath(Path(__file__).resolve().parents[2].as_posix())


def normalize_path(path: str) -> str:
    """Repo-relative, forward-slash form of a file path in this checkout.

    Raises ValueError for an absolute path outside this checkout.
    """
    normalized = path.replace("\\", "/")

    # check if this is an absolute path
    if normalized.startswith("/"):
        return PurePosixPath(normalized).relative_to(_REPO_ROOT).as_posix()

    return normalized.removeprefix("./")


@dataclass(frozen=True)
class BaselineSignature:
    """Identifies one API lint violation the same way in every tool.

    Fields are normalized whenever a signature is created, so two descriptions
    of the same violation always produce equal signatures
    """

    rule: ApiRule
    path: str
    scope: str
    key: str | None = None

    def __post_init__(self) -> None:
        # the dataclass is frozen, so normalized values are set with object.__setattr__
        object.__setattr__(self, "path", normalize_path(self.path))
        object.__setattr__(self, "key", self.key or None)
