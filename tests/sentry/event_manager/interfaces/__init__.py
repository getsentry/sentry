from collections.abc import Callable
from typing import TypeVar

SnapshotInput = TypeVar("SnapshotInput")

CustomSnapshotter = Callable[[SnapshotInput], None]
