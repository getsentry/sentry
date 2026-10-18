from __future__ import annotations

import json
import os
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Any, cast

MANIFEST_ENV = "PYTEST_PARALLEL_MANIFEST"
_DOCUMENT_KEYS = frozenset({"version", "files", "nodeids"})


class ManifestError(Exception):
    pass


@dataclass(frozen=True, slots=True)
class Manifest:
    files: tuple[str, ...]
    nodeids: tuple[str, ...]


def dump_manifest(path: Path, nodeids: Sequence[str]) -> None:
    files: list[str] = []
    seen: set[str] = set()
    for nodeid in nodeids:
        file_part = nodeid.partition("::")[0]
        if file_part not in seen:
            seen.add(file_part)
            files.append(file_part)
    text = (
        json.dumps({"version": 1, "files": files, "nodeids": list(nodeids)}, ensure_ascii=False)
        + "\n"
    )
    temporary = path.with_name(f".{path.name}.tmp")
    try:
        temporary.write_text(text, encoding="utf-8")
        os.replace(temporary, path)
    except OSError:
        temporary.unlink(missing_ok=True)
        raise


def load_manifest(path: Path) -> Manifest:
    try:
        text = path.read_text(encoding="utf-8")
    except OSError as exc:
        raise ManifestError(f"unreadable manifest: {path}") from exc
    try:
        payload = json.loads(text)
    except json.JSONDecodeError as exc:
        raise ManifestError(f"invalid manifest JSON: {path}") from exc
    if not isinstance(payload, dict) or set(payload) != _DOCUMENT_KEYS:
        raise ManifestError(f"invalid manifest document: {path}")
    version = payload["version"]
    if type(version) is not int or version != 1:
        raise ManifestError(f"invalid manifest version: {path}")
    files = _string_list(payload["files"], path, "files")
    nodeids = _string_list(payload["nodeids"], path, "nodeids")
    assigned = set(files)
    for nodeid in nodeids:
        if nodeid.partition("::")[0] not in assigned:
            raise ManifestError(f"manifest nodeid file is not assigned: {path}")
    return Manifest(files=tuple(files), nodeids=tuple(nodeids))


def arrange_assigned(items: Sequence[Any], manifest: Manifest) -> list[Any]:
    required_counts: dict[str, int] = {}
    order: list[tuple[str, int]] = []
    for nodeid in manifest.nodeids:
        occurrence = required_counts.get(nodeid, 0)
        required_counts[nodeid] = occurrence + 1
        order.append((nodeid, occurrence))

    assigned_files = set(manifest.files)
    seen: dict[str, int] = {}
    matched: dict[tuple[str, int], Any] = {}
    for item in items:
        nodeid = item.nodeid
        file_part = nodeid.partition("::")[0]
        if file_part not in assigned_files:
            raise ManifestError(f"changed id: {nodeid}")
        if nodeid not in required_counts:
            continue
        occurrence = seen.get(nodeid, 0)
        seen[nodeid] = occurrence + 1
        if occurrence >= required_counts[nodeid]:
            raise ManifestError(f"unexplained duplicate: {nodeid}")
        matched[(nodeid, occurrence)] = item

    for nodeid, occurrence in order:
        if (nodeid, occurrence) not in matched:
            raise ManifestError(f"missing id: {nodeid}")
    return [matched[key] for key in order]


def ignores_collection(collection_path: Path, root: Path, files: Sequence[str]) -> bool:
    candidate = _resolve(collection_path)
    for assigned in _assigned_paths(root, files):
        try:
            assigned.relative_to(candidate)
        except ValueError:
            continue
        return False
    return True


def _string_list(value: object, path: Path, name: str) -> list[str]:
    if not isinstance(value, list) or any(not isinstance(item, str) for item in value):
        raise ManifestError(f"invalid manifest {name}: {path}")
    return cast(list[str], value)


def _assigned_paths(root: Path, files: Sequence[str]) -> list[Path]:
    paths: list[Path] = []
    for file_name in files:
        path = Path(file_name)
        if not path.is_absolute():
            path = root / path
        paths.append(_resolve(path))
    return paths


def _resolve(path: Path) -> Path:
    try:
        return path.resolve()
    except OSError:
        return path
