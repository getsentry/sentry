#!/usr/bin/env python3
from __future__ import annotations

import re
from pathlib import Path


def source_file_to_module(repo_relative_path: str) -> str | None:
    if not repo_relative_path.startswith("src/") or not repo_relative_path.endswith(".py"):
        return None
    return repo_relative_path.removeprefix("src/").removesuffix(".py").replace("/", ".")


def find_test_imports(source_files: list[str], repo_root: Path) -> set[str]:
    modules: dict[str, str] = {}
    for f in source_files:
        m = source_file_to_module(f)
        if m:
            modules[f] = m

    if not modules:
        return set()

    tests_root = repo_root / "tests"
    if not tests_root.exists():
        return set()

    importers: dict[str, set[str]] = {f: set() for f in modules}

    for test_file in tests_root.rglob("*.py"):
        try:
            content = test_file.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        rel_path = test_file.relative_to(repo_root).as_posix()
        for source_file, module in modules.items():
            escaped = re.escape(module)
            if re.search(rf"from {escaped} import|import {escaped}(?:\s|;|$)", content):
                importers[source_file].add(rel_path)

    for source_file, found in importers.items():
        if found:
            print(f"  {source_file} -> {len(found)} importer(s) via static import search")
        else:
            print(f"  No test importers found for: {source_file}")

    return {t for found in importers.values() for t in found}
