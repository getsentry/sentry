"""Tests for bump-version.py."""

from __future__ import annotations

import importlib
from unittest import mock

import pytest

# Module has a hyphen in its name, so use importlib.
_mod = importlib.import_module("bump-version")
main = _mod.main
pr_option_args = _mod.pr_option_args

ENV = {
    "PACKAGE": "sentry-arroyo",
    "VERSION": "1.2.3",
    "PR_OPTIONS": "",
    "SENDER": "octocat",
    "SENDER_ID": "1",
}


@pytest.mark.parametrize(
    ("pr_options", "expected"),
    [
        ("", []),
        ("   \t ", []),
        ("--reviewer a", ["--reviewer", "a"]),
        ("  --reviewer\ta  --draft ", ["--reviewer", "a", "--draft"]),
        # Only the first line is read, and quotes, globs, and $ stay literal.
        ("--title 'a b' *\n--draft", ["--title", "'a", "b'", "*"]),
        ("$(touch pwned) \\n", ["$(touch", "pwned)", "\\n"]),
        ("\n--draft", []),
    ],
)
def test_pr_option_args(pr_options: str, expected: list[str]) -> None:
    assert pr_option_args(pr_options) == expected


def _run_main(env: dict[str, str], diff_returncode: int) -> list[tuple[str, ...]]:
    calls: list[tuple[str, ...]] = []

    def fake_run(args: tuple[str, ...]) -> mock.Mock:
        calls.append(tuple(args))
        returncode = diff_returncode if args[:2] == ("git", "diff") else 0
        return mock.Mock(returncode=returncode)

    with mock.patch.dict("os.environ", env, clear=True):
        with mock.patch("subprocess.run", side_effect=fake_run):
            main()
    return calls


def test_no_change_opens_no_pull_request() -> None:
    calls = _run_main(ENV, diff_returncode=0)
    assert calls == [
        ("git", "checkout", "-b", "bot/bump-version/sentry-arroyo/1.2.3"),
        ("python3", "-S", "-m", "tools.bump_version", "sentry-arroyo", "1.2.3"),
        ("git", "diff", "--exit-code"),
    ]


def test_change_opens_pull_request_with_options() -> None:
    calls = _run_main({**ENV, "PR_OPTIONS": "--reviewer someone"}, diff_returncode=1)
    assert calls[3] == (
        "git",
        "-c",
        "user.name=getsentry-bot",
        "-c",
        "user.email=10587625+getsentry-bot@users.noreply.github.com",
        "commit",
        "--all",
        "--message",
        "ref: bump sentry-arroyo to 1.2.3",
        "--message",
        "Co-Authored-By: octocat <1+octocat@users.noreply.github.com>",
    )
    assert calls[4:] == [
        ("git", "push", "origin", "HEAD", "--quiet"),
        ("gh", "pr", "create", "--fill", "--reviewer", "someone"),
    ]


def test_failed_command_exits_with_its_status() -> None:
    with mock.patch.dict("os.environ", ENV, clear=True):
        with mock.patch("subprocess.run", return_value=mock.Mock(returncode=4)):
            with pytest.raises(SystemExit) as excinfo:
                main()
    assert excinfo.value.code == 4


def test_latest_asks_pypi() -> None:
    with mock.patch.object(_mod, "latest_version", return_value="9.9.9") as latest:
        calls = _run_main({**ENV, "VERSION": "latest"}, diff_returncode=0)
    latest.assert_called_once_with("sentry-arroyo")
    assert calls[0] == ("git", "checkout", "-b", "bot/bump-version/sentry-arroyo/9.9.9")


@pytest.mark.parametrize(
    ("curl_rc", "jq_rc", "expected_exit"),
    [(6, 0, 6), (0, 5, 5), (6, 5, 5)],
)
def test_latest_version_fails_like_pipefail(curl_rc: int, jq_rc: int, expected_exit: int) -> None:
    results = [
        mock.Mock(returncode=curl_rc, stdout=b""),
        mock.Mock(returncode=jq_rc, stdout=b""),
    ]
    with mock.patch("subprocess.run", side_effect=results):
        with pytest.raises(SystemExit) as excinfo:
            _mod.latest_version("pkg")
    assert excinfo.value.code == expected_exit


def test_latest_version_returns_jq_output() -> None:
    results = [
        mock.Mock(returncode=0, stdout=b'{"info": {"version": "1.2.3"}}'),
        mock.Mock(returncode=0, stdout=b"1.2.3\n"),
    ]
    with mock.patch("subprocess.run", side_effect=results) as run:
        assert _mod.latest_version("pkg") == "1.2.3"
    assert run.call_args_list[0].args[0] == ["curl", "-sL", "https://pypi.org/pypi/pkg/json"]
