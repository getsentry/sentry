"""Tests for the Cursor Origin Git-over-HTTPS helpers.

These use a local bare repository as the remote rather than mocking ``subprocess``.
Mocking git here would test the argument strings and nothing else, and the things most
likely to be wrong are behaviours of real git: whether the archive carries the single
top-level directory Seer's extractor requires, whether a commit lands on a new branch
started from an arbitrary base sha, and whether a colliding branch name fails loudly
(Seer's retry depends on it) rather than being force-overwritten.
"""

from __future__ import annotations

import io
import os
import subprocess
import tarfile
from pathlib import Path

import pytest

from sentry.integrations.cursor_origin.git import (
    CursorOriginGitError,
    archive_ref,
    build_clone_url,
    commit_and_push,
)
from sentry.testutils.cases import TestCase


def _git(*args: str, cwd: str) -> str:
    return subprocess.run(
        ["git", *args], cwd=cwd, capture_output=True, text=True, check=True
    ).stdout.strip()


class CursorOriginGitTestBase(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.remote = str(self.tmpdir / "remote.git")
        work = str(self.tmpdir / "work")
        os.makedirs(work)

        subprocess.run(
            ["git", "init", "--bare", "-b", "main", self.remote], check=True, capture_output=True
        )
        subprocess.run(["git", "init", "-b", "main", work], check=True, capture_output=True)
        for name, body in (("README.md", "hello\n"), ("src/app.py", "print('x')\n")):
            path = os.path.join(work, name)
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, "w") as f:
                f.write(body)
        _git("add", "--all", cwd=work)
        _git("-c", "user.name=t", "-c", "user.email=t@e.com", "commit", "-m", "init", cwd=work)
        _git("remote", "add", "origin", self.remote, cwd=work)
        _git("push", "--quiet", "origin", "main", cwd=work)
        self.base_sha = _git("rev-parse", "HEAD", cwd=work)

    @pytest.fixture(autouse=True)
    def _tmpdir(self, tmp_path: Path) -> None:
        self.tmpdir = tmp_path


class BuildCloneUrlTest(TestCase):
    def test_embeds_token_against_the_git_host(self) -> None:
        # origin.cursor.com, not api.cursor.com -- the REST base would 404 for git.
        assert build_clone_url("sentry/nuget-trends", "oit_abc") == (
            "https://x-access-token:oit_abc@origin.cursor.com/sentry/nuget-trends.git"
        )


class ArchiveRefTest(CursorOriginGitTestBase):
    def test_archive_has_exactly_one_top_level_directory(self) -> None:
        """Seer's extractor moves the *contents* of the single root directory into place.

        A tar whose entries sit at the root extracts to a wrong tree rather than
        failing, so this is a silent-corruption guard, not a cosmetic one.
        """
        blob = archive_ref(self.remote, "main", prefix="nuget-trends-main")

        with tarfile.open(fileobj=io.BytesIO(blob), mode="r:gz") as tar:
            names = tar.getnames()

        assert names
        assert len({n.split("/")[0] for n in names}) == 1
        assert any(n.endswith("/src/app.py") for n in names)


class CommitAndPushTest(CursorOriginGitTestBase):
    def _push(self, branch: str, actions: list[dict[str, object]], **kwargs: object) -> str:
        return commit_and_push(
            clone_url=self.remote,
            branch=branch,
            base_sha=self.base_sha,
            message="autofix: a change",
            actions=actions,
            **kwargs,  # type: ignore[arg-type]
        )

    def test_creates_branch_with_written_file(self) -> None:
        sha = self._push(
            "seer/fix-1",
            [{"kind": "create", "filename": "src/new.py", "content": "y = 1\n"}],
        )

        assert _git("rev-parse", "seer/fix-1", cwd=self.remote) == sha
        assert "src/new.py" in _git("show", "--name-only", "--format=", sha, cwd=self.remote)
        # Started from base_sha, so it is exactly one commit ahead of main.
        assert _git("rev-list", "--count", f"main..{sha}", cwd=self.remote) == "1"

    def test_delete_and_move_actions(self) -> None:
        sha = self._push(
            "seer/fix-2",
            [
                {"kind": "delete", "filename": "README.md"},
                {"kind": "move", "old_filename": "src/app.py", "new_filename": "src/main.py"},
            ],
        )

        tree = _git("ls-tree", "-r", "--name-only", sha, cwd=self.remote).split()
        assert "README.md" not in tree
        assert "src/main.py" in tree
        assert "src/app.py" not in tree

    def test_author_is_recorded(self) -> None:
        sha = self._push(
            "seer/fix-3",
            [{"kind": "create", "filename": "a.txt", "content": "a\n"}],
            author_name="Seer by Sentry",
            author_email="noreply@sentry.io",
        )

        assert _git("log", "-1", "--format=%an <%ae>", sha, cwd=self.remote) == (
            "Seer by Sentry <noreply@sentry.io>"
        )

    def test_existing_branch_fails_rather_than_overwriting(self) -> None:
        """Seer recovers from a collision by retrying with a suffixed name.

        That only works if the push reports the collision -- a force push would
        silently discard whatever was already on the branch.
        """
        actions: list[dict[str, object]] = [
            {"kind": "create", "filename": "a.txt", "content": "a\n"}
        ]
        self._push("seer/dupe", actions)

        with pytest.raises(CursorOriginGitError, match="Branch already exists"):
            self._push("seer/dupe", actions)

    def test_no_op_change_is_refused(self) -> None:
        """An autofix that changed nothing would otherwise open an empty pull request."""
        with pytest.raises(CursorOriginGitError, match="No changes to commit"):
            self._push(
                "seer/empty",
                [{"kind": "create", "filename": "README.md", "content": "hello\n"}],
            )
