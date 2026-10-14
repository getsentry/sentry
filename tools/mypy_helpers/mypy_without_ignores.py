from __future__ import annotations

import os.path
import subprocess
import sys
import tempfile
from collections.abc import Sequence
from pathlib import Path

from tools.mypy_helpers.config_sections import InvalidMarkedSection, clear_marked_section
from tools.mypy_helpers.mypy_config import InvalidMypyConfig, relocate_path_options

ERROR_SECTION = "sentry modules with typing issues"


def main(argv: Sequence[str] | None = None) -> int:
    args = sys.argv[1:] if argv is None else argv
    project_path = Path("pyproject.toml")
    try:
        source = project_path.read_text()
        profile = clear_marked_section(source, ERROR_SECTION)
        profile = relocate_path_options(profile, project_path.resolve().parent)
    except (InvalidMarkedSection, InvalidMypyConfig) as exc:
        print(str(exc), file=sys.stderr)
        return 2

    temp_root = Path(".work/tmp")
    temp_root.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=temp_root) as tmpdir:
        config_path = os.path.join(tmpdir, "mypy.toml")
        with open(config_path, "w") as config_file:
            config_file.write(profile)
        return subprocess.call(("mypy", "--config", config_path, *args))


if __name__ == "__main__":
    raise SystemExit(main())
