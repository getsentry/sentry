from pathlib import Path

import yaml

ROOT = Path(__file__).parents[2]
WORKFLOW = yaml.safe_load((ROOT / ".github/workflows/pre-commit.yml").read_text())
STEPS = {step.get("id"): step for step in WORKFLOW["jobs"]["lint"]["steps"]}
LINT_CONFIG = yaml.safe_load(STEPS["changes"]["with"]["filters"])["lint_config"]


def test_lint_config_paths_exist() -> None:
    for path in LINT_CONFIG:
        assert (ROOT / path).is_file(), path


def test_lint_config_change_lints_all_files() -> None:
    prek = STEPS["prek"]
    assert prek["env"]["LINT_CONFIG_CHANGED"] == "${{ steps.changes.outputs.lint_config }}"
    assert "--all-files" in (ROOT / prek["run"]).read_text()
