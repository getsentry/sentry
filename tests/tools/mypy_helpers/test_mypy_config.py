import tomllib
from pathlib import Path

from tools.mypy_helpers.mypy_config import relocate_path_options


def test_relocates_path_options_and_keeps_module_selectors(tmp_path: Path) -> None:
    source_root = tmp_path / "checkout"
    source_root.mkdir()
    config = """\
[tool.mypy]
files = [
  ".",
  "sentry.api",
]
mypy_path = [
  "fixtures/stubs-for-mypy",
]

[[tool.mypy.overrides]]
module = ["sentry.*"]
disallow_untyped_defs = false
"""

    relocated = relocate_path_options(config, source_root)
    parsed = tomllib.loads(relocated)

    assert parsed["tool"]["mypy"]["files"] == [str(source_root), "sentry.api"]
    assert parsed["tool"]["mypy"]["mypy_path"] == [
        str(source_root / "fixtures/stubs-for-mypy")
    ]
    assert parsed["tool"]["mypy"]["overrides"] == [
        {"module": ["sentry.*"], "disallow_untyped_defs": False}
    ]
