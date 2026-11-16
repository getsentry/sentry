from __future__ import annotations

import ast
from pathlib import Path

from tools.flake8_plugin import ApiInputViolation, get_api_violations


def collect_findings(
    root: Path, paths: list[str] | None = None
) -> list[tuple[str, ApiInputViolation]]:
    """Collects every API rule finding under root/src as a list. Callers pick the rules they need,
    i.e the baseline only keeps BASELINED_RULES while the report card shows every rule
    `root` the repo's top folder, the one that contains /src
    `paths` a list of paths that we should only collect findings for and not all of `root`. None scans every file under root/src
    Returns a list of (`path`, `ApiInputViolation`) pairs where path is repo-based (i.e, "src/sentry/etc")
    """
    files: list[Path] = []
    if paths is None:
        # scan every file under src/
        files = sorted((root / "src").rglob("*.py"))
    else:
        for path in sorted(paths):
            file = root / path
            # skip deleted files
            if file.exists():
                files.append(file)

    # [("path", ApiInputViolation())]
    path_violation: list[tuple[str, ApiInputViolation]] = []

    for file in files:
        root_path = file.relative_to(root).as_posix()

        module_node = ast.parse(source=file.read_text(encoding="utf-8"), filename=root_path)

        violations = get_api_violations(tree=module_node, filename=root_path, all_rules=True)

        # one pair per violation and all point at the same file
        for violation in violations:
            path_violation.append((root_path, violation))

    return path_violation
