"""Git-over-HTTPS operations for Cursor Origin.

Every other SCM operation in this integration is a REST call, and Seer reaches those
through the SCM proxy (``/api/0/internal/scm-rpc/``): Seer's provider composes a
request, Sentry executes it with the installation credentials, and the raw response is
streamed back. Seer holds no forge credentials -- that is true of GitLab entirely, and
of GitHub's default path.

Origin cannot be served that way for two operations, and the reason is not a missing
endpoint we could add later:

* **There is no archive route.** ``tarball``/``zipball``/``archive`` all 404, so a repo
  cannot be materialized with a GET the way GitHub's and GitLab's can.
* **There is no write route for a commit, branch, ref, blob, or tree.** The entire
  git-write surface is Git-over-HTTPS. ``create_commit`` is not merely unimplemented in
  the scm provider; there is nothing to implement it with.

Git-over-HTTPS is a different protocol to a different host (``origin.cursor.com``, not
``api.cursor.com``), so the REST proxy cannot carry it. Something has to run ``git``
where the credentials are, and that is here. Seer reaches these over the seer-rpc
channel instead, which keeps the invariant that matters: the Origin app key and the
installation tokens minted from it never leave Sentry.

The token is passed to git in the clone URL, matching how Seer's own
``CachedRepoManager`` does it. That puts it in the child process's argv, and ``git
clone`` persists it into the clone's ``.git/config`` -- both are bounded here by the
clone living in a temporary directory that is removed on the way out, but neither is
something to copy into a multi-tenant context without revisiting.
"""

from __future__ import annotations

import base64
import logging
import os
import re
import shutil
import subprocess
import tempfile
from collections.abc import Iterator, Sequence
from contextlib import contextmanager
from typing import Any

from sentry.integrations.cursor_origin.constants import CURSOR_ORIGIN_GIT_BASE_URL

logger = logging.getLogger(__name__)

# A clone of a repository we are about to archive or commit to. Origin repositories are
# ordinary git repositories, so this is bounded by the repo, not by our use of it.
GIT_TIMEOUT_SECONDS = 600

# Written into the commit when the caller supplies no author. Seer normally passes one.
DEFAULT_AUTHOR_NAME = "Seer by Sentry"
DEFAULT_AUTHOR_EMAIL = "noreply@sentry.io"


class CursorOriginGitError(Exception):
    """A git invocation against Origin failed.

    Carries a message already scrubbed of the access token -- see ``_run``.
    """


def build_clone_url(repo_full_name: str, access_token: str) -> str:
    """``https://x-access-token:{token}@origin.cursor.com/{owner}/{repo}.git``.

    ``repo_full_name`` is Origin's ``fullName`` (``sentry/nuget-trends``), which is what
    Sentry stores as ``Repository.name``.
    """
    return f"https://x-access-token:{access_token}@{CURSOR_ORIGIN_GIT_BASE_URL.removeprefix('https://')}/{repo_full_name}.git"


# Credentials embedded in a URL, as git echoes them back in its own error text
# ("unable to access 'https://x-access-token:oit_...@origin.cursor.com/...'"). Matched
# on the URL shape rather than on the token value so that scrubbing does not depend on
# the caller remembering to pass the secret in.
_URL_CREDENTIALS = re.compile(r"(?<=//)[^/\s@]+:[^/\s@]+(?=@)")


def _scrub(text: str) -> str:
    return _URL_CREDENTIALS.sub("<redacted>", text)


def _run(args: Sequence[str], *, cwd: str | None = None) -> bytes:
    """Run a git command, raising ``CursorOriginGitError`` with scrubbed output."""
    try:
        completed = subprocess.run(
            list(args),
            cwd=cwd,
            capture_output=True,
            timeout=GIT_TIMEOUT_SECONDS,
            # Never let git stop for credentials; fail instead of hanging a worker.
            env={**os.environ, "GIT_TERMINAL_PROMPT": "0"},
        )
    except subprocess.TimeoutExpired as e:
        raise CursorOriginGitError(f"git timed out after {GIT_TIMEOUT_SECONDS}s") from e

    if completed.returncode != 0:
        stderr = _scrub(completed.stderr.decode("utf-8", "replace"))
        raise CursorOriginGitError(f"git failed ({completed.returncode}): {stderr.strip()[:500]}")

    return completed.stdout


@contextmanager
def cloned_repo(clone_url: str) -> Iterator[str]:
    """Clone ``clone_url`` into a temporary directory, yielding its path.

    The clone is full rather than shallow on purpose: callers address arbitrary commits
    (Seer materializes a specific ``base_sha``, not a branch tip), and fetching an
    arbitrary sha into a shallow clone depends on the server allowing
    ``uploadpack.allowReachableSHA1InWant``, which Origin does not document either way.
    A full clone is the option that does not depend on an unverified server setting.
    """
    tmp_dir = tempfile.mkdtemp(prefix="cursor-origin-")
    repo_dir = os.path.join(tmp_dir, "repo")
    try:
        _run(["git", "clone", "--quiet", clone_url, repo_dir])
        yield repo_dir
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


def archive_ref(clone_url: str, ref: str, *, prefix: str) -> bytes:
    """Return a gzipped tar of ``ref``, shaped like GitHub's and GitLab's tarballs.

    ``--prefix`` is not cosmetic. Seer's extraction assumes a single top-level directory
    and moves its *contents* into place (``sandbox/providers/local.py``); a tar whose
    entries sit at the root would extract to a wrong tree rather than fail, so this is
    one of the places where getting it wrong is silent.
    """
    with cloned_repo(clone_url) as repo_dir:
        return _run(["git", "archive", "--format=tar.gz", f"--prefix={prefix}/", ref], cwd=repo_dir)


def _apply_action(repo_dir: str, action: dict[str, Any]) -> None:
    """Apply one commit action to the working tree.

    The shapes mirror scm-platform's commit-action dataclasses (``WriteCommitAction``
    and friends), flattened to JSON so they survive the seer-rpc hop.
    """
    kind = action.get("kind")

    if kind in ("create", "update", "write"):
        path = os.path.join(repo_dir, action["filename"])
        os.makedirs(os.path.dirname(path), exist_ok=True)
        content = action["content"]
        if action.get("encoding") == "base64":
            with open(path, "wb") as f:
                f.write(base64.b64decode(content))
        else:
            with open(path, "w", encoding="utf-8") as f:
                f.write(content)

    elif kind == "delete":
        path = os.path.join(repo_dir, action["filename"])
        if os.path.exists(path):
            os.remove(path)

    elif kind == "move":
        src = os.path.join(repo_dir, action["old_filename"])
        dst = os.path.join(repo_dir, action["new_filename"])
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.move(src, dst)

    elif kind == "chmod":
        path = os.path.join(repo_dir, action["filename"])
        mode = 0o755 if action.get("executable") else 0o644
        os.chmod(path, mode)

    else:
        raise CursorOriginGitError(f"Unsupported commit action: {kind!r}")


def commit_and_push(
    *,
    clone_url: str,
    branch: str,
    base_sha: str,
    message: str,
    actions: list[dict[str, Any]],
    author_name: str | None = None,
    author_email: str | None = None,
) -> str:
    """Create ``branch`` at ``base_sha`` with ``actions`` applied, push it, return the sha.

    Pushed with a plain (non-force) ref create, so a branch that already exists on the
    remote fails rather than being overwritten. Seer retries with a suffixed name when a
    branch collides, which only works if the collision is reported rather than absorbed.
    """
    author_name = author_name or DEFAULT_AUTHOR_NAME
    author_email = author_email or DEFAULT_AUTHOR_EMAIL

    with cloned_repo(clone_url) as repo_dir:
        run = lambda *args: _run(["git", *args], cwd=repo_dir)

        # Checked explicitly rather than left to the push, because the caller's recovery
        # depends on recognizing this case: Seer retries with a suffixed branch name when
        # the message says the branch already exists. Git's own rejection for a diverged
        # ref says "Updates were rejected because the remote contains work..." instead,
        # which Seer would not match, and it would surface as a hard failure.
        try:
            _run(["git", "rev-parse", "--verify", f"origin/{branch}"], cwd=repo_dir)
        except CursorOriginGitError:
            pass  # Expected: the branch does not exist yet, which is the normal case.
        else:
            raise CursorOriginGitError(f"Branch already exists: {branch}")

        # Detach at the base commit so the new branch starts exactly there, whatever the
        # clone happened to check out.
        run("checkout", "--quiet", "--detach", base_sha)
        run("switch", "--quiet", "--create", branch)

        for action in actions:
            _apply_action(repo_dir, action)

        run("add", "--all")

        # An autofix that produced no net change would otherwise create an empty commit
        # and an empty pull request. Seer checks `ahead_by` afterwards, but failing here
        # is clearer than opening a PR with nothing in it.
        if not _run(["git", "status", "--porcelain"], cwd=repo_dir):
            raise CursorOriginGitError("No changes to commit")

        run(
            "-c",
            f"user.name={author_name}",
            "-c",
            f"user.email={author_email}",
            "commit",
            "--quiet",
            "--message",
            message,
        )
        run("push", "--quiet", "origin", f"{branch}:refs/heads/{branch}")

        return _run(["git", "rev-parse", "HEAD"], cwd=repo_dir).decode().strip()
