from __future__ import annotations

import json  # noqa: S003 - tools tests run without the sentry package
import os
import subprocess
from pathlib import Path
from unittest import mock

import pytest

from tools.api_guidelines.check_new import (
    FINDINGS_PATH,
    Finding,
    base_counts,
    changed_paths,
    find_new,
    main,
)
from tools.api_guidelines.rules import RULES, ApiRule
from tools.api_guidelines.signature import BaselineSignature

PATH = "src/sentry/api/endpoints/example.py"

# reads query:id twice in the same method so both findings share one signature
EXAMPLE_ENDPOINT = """\
class ExampleEndpoint(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    def get(self, request) -> Response[X]:
        a = request.GET.get("id")
        b = request.GET.get("id")
        return Response(a)
"""


# the same endpoint before the PR added its second read
ONE_READ = """\
class ExampleEndpoint(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}

    def get(self, request) -> Response[X]:
        a = request.GET.get("id")
        return Response(a)
"""


@pytest.fixture
def repo(tmp_path: Path) -> Path:
    """A checkout with EXAMPLE_ENDPOINT"""
    endpoint = tmp_path / PATH
    endpoint.parent.mkdir(parents=True)
    endpoint.write_text(EXAMPLE_ENDPOINT)
    return tmp_path


def _counts(tmp_path: Path, base_source: str) -> dict[BaselineSignature, int]:
    """base_counts for PATH when its base version is `base_source`"""
    base = tmp_path / "base"
    (base / PATH).parent.mkdir(parents=True)
    (base / PATH).write_text(base_source)
    return base_counts(base, [PATH])


def _lines(new: list[Finding]) -> list[tuple[str, int]]:
    """(path, line) of each finding"""
    located: list[tuple[str, int]] = []
    for path, violation in new:
        located.append((path, violation.line))
    return located


def test_every_finding_in_a_file_the_pr_added_is_new(repo: Path) -> None:
    new, unparsed = find_new(repo, [PATH], {})

    assert _lines(new) == [(PATH, 5), (PATH, 6)]
    assert unparsed == []


def test_a_finding_already_at_the_merge_base_is_not_new(repo: Path, tmp_path: Path) -> None:
    new, _ = find_new(repo, [PATH], _counts(tmp_path, EXAMPLE_ENDPOINT))

    assert new == []


def test_a_count_above_the_merge_base_flags_every_line_with_that_signature(
    repo: Path, tmp_path: Path
) -> None:
    new, _ = find_new(repo, [PATH], _counts(tmp_path, ONE_READ))

    assert _lines(new) == [(PATH, 5), (PATH, 6)]


def test_only_python_files_under_src_are_checked() -> None:
    raw = json.dumps([PATH, "tests/sentry/test_example.py", "static/app/x.tsx", PATH])

    assert changed_paths(raw) == [PATH]


def test_a_file_that_doesnt_parse_is_skipped_and_the_rest_are_checked(repo: Path) -> None:
    broken = "src/sentry/api/endpoints/broken.py"
    (repo / broken).write_text("def get(:\n")

    new, unparsed = find_new(repo, [broken, PATH], {})

    assert unparsed == [broken]
    assert _lines(new) == [(PATH, 5), (PATH, 6)]


def _git(root: Path, *args: str) -> str:
    """Runs git in `root` without the user's config"""
    env = {**os.environ, "GIT_CONFIG_GLOBAL": os.devnull, "GIT_CONFIG_NOSYSTEM": "1"}
    result = subprocess.run(
        ["git", "-c", "user.name=t", "-c", "user.email=t@example.com", *args],
        cwd=root,
        env=env,
        check=True,
        capture_output=True,
        text=True,
    )
    return result.stdout.strip()


def _commit_merge_base(root: Path) -> str:
    """Commits what's in `root` as the merge base, with root as its own origin to fetch from
    Returns the commit's sha
    """
    _git(root, "init", "-q")
    _git(root, "add", "-A")
    _git(root, "commit", "-q", "--allow-empty", "-m", "base")
    _git(root, "remote", "add", "origin", str(root))
    return _git(root, "rev-parse", "HEAD")


def _run(root: Path, changed_files: str, merge_base: str = "") -> int:
    """main() with CHANGED_FILES and MERGE_BASE set"""
    env = {"CHANGED_FILES": changed_files, "MERGE_BASE": merge_base}
    with mock.patch.dict(os.environ, env):
        return main(root=root)


@pytest.fixture
def pr(tmp_path: Path) -> tuple[Path, str]:
    """A checkout whose merge base is empty and whose PR adds EXAMPLE_ENDPOINT
    Returns (the checkout, the merge base's sha)
    """
    merge_base = _commit_merge_base(tmp_path)
    endpoint = tmp_path / PATH
    endpoint.parent.mkdir(parents=True)
    endpoint.write_text(EXAMPLE_ENDPOINT)
    return tmp_path, merge_base


@pytest.mark.parametrize("changed_files", ["", "[]"])
def test_nothing_to_check_exits_0(repo: Path, changed_files: str) -> None:
    assert _run(repo, changed_files) == 0


def test_no_merge_base_exits_1(repo: Path) -> None:
    assert _run(repo, json.dumps([PATH])) == 1


def test_a_merge_base_that_cant_be_fetched_exits_1(pr: tuple[Path, str]) -> None:
    root, _ = pr

    assert _run(root, json.dumps([PATH]), "0" * 40) == 1


def test_findings_already_at_the_merge_base_are_not_written(repo: Path) -> None:
    merge_base = _commit_merge_base(repo)

    assert _run(repo, json.dumps([PATH]), merge_base) == 0

    assert json.loads((repo / FINDINGS_PATH).read_text()) == []


def test_new_findings_exit_0_with_a_warning_annotation_per_line(
    pr: tuple[Path, str], capsys: pytest.CaptureFixture[str]
) -> None:
    root, merge_base = pr

    assert _run(root, json.dumps([PATH]), merge_base) == 0

    annotations: list[str] = []
    for line in capsys.readouterr().out.splitlines():
        if line.startswith("::warning "):
            annotations.append(line.split("::")[1])
    assert annotations == [
        f"warning file={PATH},line=5,title=New API finding S026",
        f"warning file={PATH},line=6,title=New API finding S026",
    ]


def test_new_findings_are_written_for_the_pr_comment(pr: tuple[Path, str]) -> None:
    root, merge_base = pr

    _run(root, json.dumps([PATH]), merge_base)

    rows = json.loads((root / FINDINGS_PATH).read_text())
    s026 = RULES[ApiRule.S026]
    assert rows == [
        {"path": PATH, "line": 5, "rule": "S026", "title": s026.title, "fix": s026.fix},
        {"path": PATH, "line": 6, "rule": "S026", "title": s026.title, "fix": s026.fix},
    ]


def test_a_file_that_doesnt_parse_gets_a_notice_on_it(
    pr: tuple[Path, str], capsys: pytest.CaptureFixture[str]
) -> None:
    root, merge_base = pr
    broken = "src/sentry/api/endpoints/broken.py"
    (root / broken).write_text("def get(:\n")

    assert _run(root, json.dumps([broken]), merge_base) == 0

    assert capsys.readouterr().out.startswith(f"::notice file={broken}::")
