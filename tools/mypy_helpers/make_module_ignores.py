from __future__ import annotations

import json
import os
import subprocess
import sys
from collections.abc import Sequence
from pathlib import Path

from tools.mypy_helpers.config_sections import InvalidMarkedSection, replace_marked_section
from tools.mypy_helpers.mypy_output import InvalidMypyOutput, parse_mypy_output

ERROR_SECTION = "sentry modules with typing issues"


def _module_for_filename(filename: str, source_root: Path) -> str:
    path = Path(filename)
    if path.is_absolute():
        try:
            path = path.resolve().relative_to(source_root)
        except ValueError as exc:
            raise InvalidMypyOutput(f"diagnostic source is outside the checkout: {filename}") from exc
    parts = list(path.parts)
    if parts and parts[0] == "src":
        parts.pop(0)
    if path.suffix not in {".py", ".pyi"}:
        raise InvalidMypyOutput(f"diagnostic does not identify a Python source: {filename}")
    parts[-1] = parts[-1].removesuffix(path.suffix)
    if parts[-1] == "__init__":
        parts.pop()
    if not parts:
        raise InvalidMypyOutput(f"diagnostic has no module identity: {filename}")
    return ".".join(parts)


def _toml_string(value: str) -> str:
    return json.dumps(value, ensure_ascii=False)


def main(argv: Sequence[str] | None = None) -> int:
    args = sys.argv[1:] if argv is None else argv
    project_path = Path("pyproject.toml")
    original_config = project_path.read_text()
    try:
        replace_marked_section(original_config, ERROR_SECTION, "")
    except InvalidMarkedSection as exc:
        print(str(exc), file=sys.stderr)
        return 2

    out = subprocess.run(
        (sys.executable, "-m", "tools.mypy_helpers.mypy_without_ignores", *args),
        capture_output=True,
    )
    try:
        run = parse_mypy_output(out.stdout, out.stderr, out.returncode)
        source_root = Path.cwd().resolve()
        modules = sorted({_module_for_filename(item.filename or "", source_root) for item in run.errors})
        codes = sorted({item.code for item in run.errors if item.code is not None})
    except InvalidMypyOutput as exc:
        print(f"{exc}\n{out.stderr.decode(errors='replace')}", file=sys.stderr)
        return 2

    generated = ""
    if modules:
        modules_s = "".join(f"    {_toml_string(module)},\n" for module in modules)
        codes_s = "".join(f"    {_toml_string(code)},\n" for code in codes)
        generated = (
            "# - remove the module from the list and fix the issues!\n"
            "# - python3 -m tools.mypy_helpers.find_easiest_modules\n"
            "[[tool.mypy.overrides]]\n"
            f"module = [\n{modules_s}]\n"
            f"disable_error_code = [\n{codes_s}]\n"
        )

    try:
        updated_config = replace_marked_section(original_config, ERROR_SECTION, generated)
    except InvalidMarkedSection as exc:
        print(str(exc), file=sys.stderr)
        return 2
    os.makedirs(".artifacts", exist_ok=True)
    Path(".artifacts/mypy-all").write_bytes(out.stdout)
    project_path.write_text(updated_config)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
