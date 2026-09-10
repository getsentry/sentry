from __future__ import annotations

from typing import Any
from unittest.mock import patch

from sentry.integrations.cursor_origin.repository import CursorOriginRepositoryProvider
from sentry.testutils.cases import TestCase


def commit(sha: str, message: str = "msg") -> dict[str, Any]:
    return {
        "sha": sha,
        "commit": {
            "author": {
                "name": "Bruno",
                "email": "bruno@example.com",
                "date": "2026-01-01T00:00:00Z",
            },
            "message": message,
        },
    }


class CompareCommitsWalkTest(TestCase):
    """Origin's compare endpoint returns only counts and boundary commits.

    There is no route giving the commits or files between two arbitrary shas, so
    the range is rebuilt by walking back from the head.
    """

    def setUp(self) -> None:
        super().setUp()
        from sentry.integrations.cursor_origin.client import CursorOriginSetupApiClient

        self.api_client = CursorOriginSetupApiClient(installation_id="i_01example")

    def _walk(self, history: list[str], start: str, end: str) -> list[str]:
        with patch.object(
            type(self.api_client), "get_commits", return_value=[commit(s) for s in history]
        ):
            result = self.api_client.compare_commits("o/r", start, end)
        return [c["sha"] for c in result]

    def test_returns_range_oldest_first_excluding_start(self) -> None:
        # get_commits returns newest first; releases want oldest first, and the
        # already-released start sha must not be re-associated.
        assert self._walk(["d", "c", "b", "a"], start="a", end="d") == ["b", "c", "d"]

    def test_single_commit_range(self) -> None:
        assert self._walk(["b", "a"], start="a", end="b") == ["b"]

    def test_returns_empty_when_head_is_the_start(self) -> None:
        assert self._walk(["a", "z"], start="a", end="a") == []

    def test_truncates_rather_than_failing_when_start_is_unreachable(self) -> None:
        # A shallow walk that never finds the start sha still returns what it
        # saw -- a truncated release beats a failed one.
        assert self._walk(["d", "c", "b"], start="missing", end="d") == ["b", "c", "d"]


class TransformPatchsetTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.provider = CursorOriginRepositoryProvider("integrations:cursor_origin")

    def test_maps_statuses(self) -> None:
        assert self.provider._transform_patchset(
            [
                {"filename": "a.py", "status": "modified"},
                {"filename": "b.py", "status": "added"},
                {"filename": "c.py", "status": "removed"},
            ]
        ) == [
            {"path": "a.py", "type": "M"},
            {"path": "b.py", "type": "A"},
            {"path": "c.py", "type": "D"},
        ]

    def test_rename_becomes_a_delete_and_an_add(self) -> None:
        assert self.provider._transform_patchset(
            [{"filename": "new.py", "previous_filename": "old.py", "status": "renamed"}]
        ) == [{"path": "old.py", "type": "D"}, {"path": "new.py", "type": "A"}]

    def test_rename_without_previous_name_still_records_the_add(self) -> None:
        assert self.provider._transform_patchset([{"filename": "new.py", "status": "renamed"}]) == [
            {"path": "new.py", "type": "A"}
        ]

    def test_skips_unknown_status_and_missing_filename(self) -> None:
        assert (
            self.provider._transform_patchset(
                [{"filename": "a.py", "status": "unchanged"}, {"status": "modified"}]
            )
            == []
        )
